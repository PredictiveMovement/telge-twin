# Load & Capacity Configuration

This note explains how booking sizes and vehicle capacity are derived inside the simulator, and where you can change those values.

## Booking volume/weight

Each booking’s load is computed in `packages/simulator/lib/loadEstimator.ts`:

- The service type (`booking.originalRecord.Tjtyp` or `booking.originalData.originalTjtyp`) is looked up in `settings.tjtyper`. Set `VOLYM` (litres) and `FYLLNADSGRAD` (percentage) there to control the expected pickup volume for all bookings that use that service type.
- The recycling type (`booking.recyclingType`) is matched against `settings.avftyper`. Set the `VOLYMVIKT` (kg/m³) to translate volume into weight for that material.
- If a booking lacks a service type or matching dataset entries, the fallback is 140 L at 100 % fill. Adjusting this requires editing `FALLBACK_VOLUME_LITERS` in `loadEstimator.ts` (line ~8).

**Per-booking overrides**: make sure the raw data that feeds the simulator contains the correct `Tjtyp` and recycling type. Those values end up on the Booking instances and drive the estimator. There is no additional manual setting per booking in the simulator code; the dataset is the source of truth.

## Vehicle compartments (fack)

Vehicle capacity is derived from the dataset’s `fleetConfiguration` objects (as created by the visualization tooling). A typical vehicle entry contains `fackDetails`:

```json
{
  "fackNumber": 1,
  "avfallstyper": [{ "avftyp": "HEMSORT" }],
  "volym": 9,
  "vikt": 0
}
```

- `volym` is interpreted as m³ and converted to litres internally (`volym * 1000`).
- `vikt` is a per-compartment kg limit.
- `avfallstyper` restrict which recycling types can use the compartment.

If a truck has no `fackDetails`, the simulator creates a single unrestricted compartment. The VROOM planner then falls back to a simple booking-count capacity based on `parcelCapacity` (default 250 if the dataset does not provide a sensible value).

## VROOM capacity vectors

The planner sends one capacity value per relevant dimension (volume litres, weight kg, or booking count) based on the compartment data above. This happens in `vroom.ts` via `getCapacityDimensions`. Ensure compartments are populated so the planner respects volume/weight instead of defaulting to count-only constraints.

## Hard-coded fallbacks

- Booking volume default: `FALLBACK_VOLUME_LITERS = 140` (in `loadEstimator.ts`).
- Booking fill default: `FALLBACK_FILL_PERCENT = 100` (same file).
- Booking-count capacity fallback: `CLUSTERING_CONFIG.DELIVERY_STRATEGIES.PICKUPS_BEFORE_DELIVERY` (default 150) if no compartment limits exist.
- Parcel capacity default (if dataset value < 10): 250, set in `packages/simulator/lib/fleet.ts`.

Change these constants if you need different global defaults, but prefer supplying accurate dataset values so both the sequential simulation and the VROOM optimisation stay aligned.
