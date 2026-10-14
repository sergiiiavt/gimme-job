*** Settings ***
Library    ../libraries/Inventory.py

*** Keywords ***
Start With Inventory
    Reset Inventory
    Add Product    notebook    5

Clean Up Inventory
    Reset Inventory

Remaining Stock Should Be
    [Arguments]    ${name}    ${expected}
    ${remaining}=    Get Remaining Stock    ${name}
    Should Be Equal As Integers    ${remaining}    ${expected}
