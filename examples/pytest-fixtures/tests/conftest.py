"""Standalone pytest fixtures: no live service, database, or credentials required."""

from uuid import uuid4

import pytest


@pytest.fixture(scope="session")
def run_identity():
    # Created when first requested; reused across this pytest process.
    return {"run_id": uuid4().hex}


@pytest.fixture(scope="package")
def sku_catalog():
    return ("mouse", "keyboard")


@pytest.fixture(scope="module")
def pricing(sku_catalog):
    return {"mouse": 25, "keyboard": 70}


@pytest.fixture(scope="class")
def tax_rate():
    return 0.20


@pytest.fixture(scope="function")
def cart(pricing, run_identity):
    # A fresh, mutable list for EACH test; wider-scoped inputs are read only.
    items = []
    yield items
    items.clear()  # Teardown happens even if an assertion fails after yield.


@pytest.fixture
def cart_with_mouse(cart):
    # Fixtures request other fixtures just like tests do.
    cart.append("mouse")
    return cart
