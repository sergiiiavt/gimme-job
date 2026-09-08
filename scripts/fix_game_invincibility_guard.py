from pathlib import Path

path = Path("app/games/games-playground.tsx")
text = path.read_text()
old = '''    function onPointerDown(event: PointerEvent) {
      if (event.button !== 0) return;
      updateAim(event);
      if (deadUntil !== 0 || now < invincibleUntil || won) return;
      pointerHeld = true;'''
new = '''    function onPointerDown(event: PointerEvent) {
      if (event.button !== 0) return;
      updateAim(event);
      if (deadUntil !== 0 || won) return;
      pointerHeld = true;'''
count = text.count(old)
if count != 2:
    raise SystemExit(f"Expected two pointer guards, found {count}")
path.write_text(text.replace(old, new))
