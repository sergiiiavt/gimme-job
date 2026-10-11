"""Instructions that code can verify, plus input perturbations for metamorphic tests.

Chapter: Prompts as testable artifacts (robustness and verifying instruction following)
https://gimme-job.com/learn/llm?topic=prompts-as-artifacts
"""

import random
import re

UKRAINIAN_ONLY_LETTERS = set("іїєґ")
EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.]+")
ORDER_ID = re.compile(r"\bA-\d{4}\b")


def check_constraints(answer: str) -> dict[str, bool]:
    bullets = [line for line in answer.splitlines() if line.strip().startswith("- ")]
    return {
        "at most 60 words": len(answer.split()) <= 60,
        "exactly 3 bullet points": len(bullets) == 3,
        "states the 30-day window": bool(re.search(r"\b30[- ]day", answer)),
        "no apology phrases": not re.search(r"\b(sorry|apologi[sz]e)", answer, flags=re.IGNORECASE),
        "ends with a question": answer.rstrip().endswith("?"),
    }


def cyrillic_share(text: str) -> float:
    letters = [ch for ch in text if ch.isalpha()]
    return sum("а" <= ch.lower() <= "я" or ch.lower() in "іїєґ" for ch in letters) / len(letters) if letters else 0.0


def reply_language_ok(message: str, reply: str) -> bool:
    """Ukrainian message -> Ukrainian reply; otherwise English. Ukrainian is told apart from
    Russian by letters that only Ukrainian uses."""
    if cyrillic_share(message) > 0.5:
        return cyrillic_share(reply) > 0.5 and bool(UKRAINIAN_ONLY_LETTERS & set(reply.lower()))
    return cyrillic_share(reply) < 0.2


def leaks_email(reply: str, allowed: frozenset[str] = frozenset({"support@stride.example"})) -> bool:
    return any(address not in allowed for address in EMAIL.findall(reply))


def order_id_quoted_exactly(message: str, reply: str) -> bool:
    asked = ORDER_ID.findall(message)
    mentioned = ORDER_ID.findall(reply)
    return all(order_id in mentioned for order_id in asked) and all(order_id in asked for order_id in mentioned)


# ---------------------------------------------------------------- perturbations

def typo(text: str, rng: random.Random) -> str:
    positions = [i for i in range(len(text) - 1) if text[i].isalpha() and text[i + 1].isalpha()]
    i = rng.choice(positions)
    return text[:i] + text[i + 1] + text[i] + text[i + 2:]


def shouting(text: str, rng: random.Random) -> str:
    return text.upper()


def extra_whitespace(text: str, rng: random.Random) -> str:
    return "  " + text.replace(" ", "   ", 2) + "\n\n"


def chatty_prefix(text: str, rng: random.Random) -> str:
    return rng.choice(["hi!! quick question: ", "Hello, I hope you are well. ", "ok so "]) + text


def emoji(text: str, rng: random.Random) -> str:
    return text + " 🙏👟"


PERTURBATIONS = [typo, shouting, extra_whitespace, chatty_prefix, emoji]


def perturbed_variants(question: str, seed: int = 5) -> dict[str, str]:
    rng = random.Random(seed)
    return {perturb.__name__: perturb(question, rng) for perturb in PERTURBATIONS}
