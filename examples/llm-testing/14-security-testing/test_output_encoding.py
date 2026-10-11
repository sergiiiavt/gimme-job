import re

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from output_encoding import to_html


@pytest.mark.parametrize("payload, expected", [
    ("See [our returns page](https://shop.example/returns).",
     'See <a href="https://shop.example/returns" rel="noopener noreferrer">our returns page</a>.'),
    ('<img src=x onerror="alert(1)">', "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;"),
    ("[Click here](javascript:alert(1))", "Click here"),
    ("[Refund form](https://shop.example.evil.example/refund)", "Refund form"),
    ("[Plain http](http://shop.example/returns)", "Plain http"),
    ("[Quote break](https://shop.example/a\"onmouseover=\"alert(1))",
     '<a href="https://shop.example/a&quot;onmouseover=&quot;alert(1)" rel="noopener noreferrer">Quote break</a>'),
])
def test_attack_payloads(payload, expected):
    assert to_html(payload) == expected


ANCHOR = re.compile(r'<a href="https://shop\.example[^"<>]*" rel="noopener noreferrer">[^<>]*</a>')


@settings(max_examples=300)
@given(st.text(max_size=200))
def test_no_markup_survives_except_safe_anchors(text):
    html = ANCHOR.sub("", to_html(text))
    assert "<" not in html and ">" not in html and '"' not in html


@given(st.text(alphabet="[]()<>\"'&:/ .jsavcriptheop", max_size=80))
def test_no_link_to_anything_but_the_allowed_host(text):
    for href in re.findall(r'href="([^"]*)"', to_html(text)):
        assert href.startswith("https://shop.example")
