"""Run: python -m pytest tests/test_scopes.py -v --setup-show"""

import pytest


def test_fixture_is_cached_within_one_test(cart, request):
    assert cart is request.getfixturevalue("cart")
    cart.append("keyboard")
    assert cart == ["keyboard"]


def test_function_scope_starts_clean(cart):
    # Works irrespective of test order: other tests cannot mutate this list.
    assert cart == []


def test_composed_fixture(cart_with_mouse, cart, pricing):
    assert cart_with_mouse is cart  # Same fixture instance in this test.
    assert sum(pricing[sku] for sku in cart_with_mouse) == 25


class TestClassScope:
    def test_price_with_tax(self, cart_with_mouse, pricing, tax_rate):
        assert sum(pricing[sku] for sku in cart_with_mouse) * (1 + tax_rate) == 30

    def test_class_fixture_does_not_replace_function_scope(self, tax_rate, cart):
        assert tax_rate == 0.20
        assert cart == []


@pytest.mark.parametrize("sku", ["mouse", "keyboard"])
def test_parametrized_case_gets_its_own_cart(sku, cart, pricing):
    assert cart == []
    cart.append(sku)
    assert pricing[cart[0]] > 0
