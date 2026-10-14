*** Settings ***
Documentation    Inventory behavior via resource keywords and a test-scoped Python adapter.
Resource    ../resources/inventory.resource
Test Setup    Start With Inventory
Test Teardown    Clean Up Inventory

*** Test Cases ***
Reserve Item Reduces Available Stock
    [Tags]    smoke    inventory
    Reserve Product    notebook    2
    Remaining Stock Should Be    notebook    3

Rejects Reservation Beyond Stock
    [Tags]    negative    inventory
    Run Keyword And Expect Error    *Not enough stock: notebook    Reserve Product    notebook    99
    Remaining Stock Should Be    notebook    5
