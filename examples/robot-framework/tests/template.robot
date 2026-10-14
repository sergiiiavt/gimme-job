*** Settings ***
Documentation    Pure core-only data-driven examples.
Test Template    Addition Should Equal

*** Test Cases ***
Two Small Integers    1    2    3
Negative And Positive    -1    2    1

*** Keywords ***
Addition Should Equal
    [Arguments]    ${left}    ${right}    ${expected}
    ${actual}=    Evaluate    int($left) + int($right)
    Should Be Equal As Integers    ${actual}    ${expected}
