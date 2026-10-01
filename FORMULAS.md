# DWM Calculation Reference

DWM recalculates derived report values twice:

1. in the browser while the operator types; and
2. again on the server before the section is saved.

The server result is authoritative.

## Well Data

- Mud weight unit: `ppg` when Mud Weight >= `8.33`, otherwise `sp.gr`.
- Hole Volume (bbls): `((Bit Size^2) / 1029) × (Current Depth - Previous Depth) × 1.1`
- Hole Volume (m3): `Hole Volume bbls / 6.2898`

## Centrifuge 1 / 2 / 3

- Cake Discharge Flow: `Feed Rate × (Feed Density - Centrate Density) / (Cake Density - Centrate Density)`
- Centrate Return: `Feed Rate - Cake Discharge Flow`
- Cake Volume (bbls): `Running Hour × (Cake Flow × 60 / 42)`
- Cake Volume (m3): `Cake Volume bbls / 6.2898`
- Wet discharge mass preserves the legacy CF1/CF2/CF3 calculation behavior for historical parity.

Division by zero is guarded and returns `0` instead of `NaN`/`Infinity`.

## Desander / Desilter

- Feed Rate: `(42 / (60 × Run Hour)) × Volume Discharge × (Underflow Density - Overflow Density) / (Feed Density - Overflow Density)`
- Volume Mud Discharge: `Mud on Cuttings × Volume Discharge × (1 + Mud on Cuttings)`

The second equation intentionally matches the original Laravel JavaScript.

## Retort

Default `% Cuttings Discharged`:

- Shaker: `90%`
- Cutting Dryer: `80%`
- Centrifuge 1/2/3: `100%`

For each Shaker/CDU/CF sample:

- Mass Dry Cuttings: `Cell + Dry Cuttings - Empty Cell`
- Weight Water/BF: `Cylinder + Water/BF - Empty Cylinder`
- Mass Wet Cuttings: `Empty Cell + Wet Sample - Empty Cell`
- Mass Base Fluid: `Weight Water/BF - Water Volume`
- Base Fluid Volume: `Mass Base Fluid / SG Base Fluid`
- `BF Fraction = Base Fluid % / 100`
- `VolBF = Base Fluid Volume / BF Fraction`
- `Adjusted = (Mass Wet Cuttings - ((Mud Weight / 8.33) × VolBF)) / SG Drill Solids`
- Mud on Cuttings: `VolBF / Adjusted`

Mud discharge:

- Shaker/CDU: `(Hole Volume × % Cuttings / 100) × Mud on Cuttings`
- Centrifuge: `Mud on Cuttings × Cake Volume / (1 + Mud on Cuttings)`

Other derived values:

- BF/Oil Discharged: `Mud Discharge × Base Fluid % / 100`
- OOC: `100 × Mass Base Fluid / Mass Wet Cuttings`
- Mud Recovered: `Shaker Mud - CDU Mud - CF1 Mud - CF2 Mud - CF3 Mud`
- Oil Recovered: `Mud Recovered × Base Fluid % / 100`

Volume-control values:

- To Dryer (bbls): `Hole Volume × Shaker Cuttings % / 100`
- To Dryer (m3): `To Dryer bbls / 6.2898`
- From Dryer (bbls): legacy Shaker/CDU percentage relationship
- From CFx (bbls): `CFx Mud Discharge / CFx Mud on Cuttings`
- Any bbls to m3 conversion: `/ 6.2898`

## Daily Waste / Average MOC / Average Discharge

The calculation follows the original `DailyWasteController`, using the corrected database column name `vol_discharge`.

The final values are:

- Daily Waste Generated: `Total WM + Total WOM`
- Average MOC: `Total WM / Total WOM`
- Average Discharge % OOC:
  `((Total WOM × SG Base Fluid × Base Fluid %) / (Total WM × SG Drill Solids + Total WOM × Mud Weight / 8.33)) × 100`

Intermediate WM/WOM calculations preserve the legacy constants and percentages.


## Preventive Maintenance Due Date

PM due date is derived from the selected PM category and is recalculated on the server when the record is saved.

- Day: `PM Start + N calendar days`
- Week: `PM Start + (N × 7) calendar days`
- Month: `PM Start + N calendar months`, clamped to the last valid day of the target month
- Year: `PM Start + N calendar years`, clamped for leap-day dates

Examples:

- `2026-01-01 + 2 Week = 2026-01-15`
- `2026-01-31 + 1 Month = 2026-02-28`
- `2028-01-31 + 1 Month = 2028-02-29`

Inspection status and PM due badges use the configured DWM timezone and a 30-day warning window.
