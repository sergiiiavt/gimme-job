"""Run after installing pytest-playwright and Chromium: pytest tests/test_playwright_isolation.py"""

from playwright.sync_api import Browser, Page, expect


def test_page_fixture_owns_a_fresh_context(page: Page):
    page.set_content("<h1>First test</h1><p id='unique'>Only here</p>")
    expect(page.get_by_role("heading", name="First test")).to_be_visible()
    expect(page.locator("#unique")).to_have_count(1)


def test_next_page_starts_without_prior_dom(page: Page):
    # pytest-playwright's page/context fixtures have function scope.
    assert page.url == "about:blank"
    expect(page.locator("#unique")).to_have_count(0)
    page.set_content("<h1>Second test</h1>")
    expect(page.get_by_role("heading", name="Second test")).to_be_visible()


def test_two_contexts_are_isolated_in_one_test(page: Page, browser: Browser):
    page.set_content("<h1>Account A</h1>")
    other_context = browser.new_context()
    try:
        other_page = other_context.new_page()
        other_page.set_content("<h1>Account B</h1>")
        expect(page.get_by_role("heading", name="Account A")).to_be_visible()
        expect(other_page.get_by_role("heading", name="Account A")).to_have_count(0)
        expect(other_page.get_by_role("heading", name="Account B")).to_be_visible()
    finally:
        # Manually created contexts are NOT managed by pytest's context fixture.
        other_context.close()
