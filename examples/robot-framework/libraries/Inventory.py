from robot.api.deco import keyword, library


@library(scope="TEST")
class Inventory:
    """Tiny in-memory adapter: one isolated instance per Robot test."""

    def __init__(self):
        self._stock: dict[str, int] = {}

    @keyword("Reset Inventory")
    def reset_inventory(self) -> None:
        self._stock.clear()

    @keyword("Add Product")
    def add_product(self, name: str, amount: int) -> None:
        if amount < 0:
            raise ValueError("Stock must be non-negative")
        self._stock[name] = amount

    @keyword("Reserve Product")
    def reserve_product(self, name: str, amount: int) -> None:
        if amount <= 0:
            raise ValueError("Reservation must be positive")
        available = self._stock.get(name, 0)
        if amount > available:
            raise ValueError(f"Not enough stock: {name}")
        self._stock[name] = available - amount

    @keyword("Get Remaining Stock")
    def get_remaining_stock(self, name: str) -> int:
        return self._stock.get(name, 0)
