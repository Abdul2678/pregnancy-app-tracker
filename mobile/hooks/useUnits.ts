// hooks/useUnits.ts
// Access unit system, date format, and conversion helpers from Redux settings.

import { useAppSelector } from '../store';
import {
  formatWeight, formatLength, formatTemperature,
  formatDate, formatDateTime, formatDateShort,
  weightLabel, lengthLabel, temperatureLabel,
  kgToLbs, lbsToKg, cmToInches, celsiusToFahrenheit, fahrenheitToCelsius,
  parseWeightToKg,
  type UnitSystem, type DateFormat,
} from '../lib/units';

export function useUnits() {
  const unitSystem = useAppSelector((s) => s.settings.unitSystem);
  const dateFormat = useAppSelector((s) => s.settings.dateFormat);

  return {
    unitSystem,
    dateFormat,
    // Weight
    displayWeight:   (kg: number) => formatWeight(kg, unitSystem),
    weightLabel:     () => weightLabel(unitSystem),
    toDisplayWeight: (kg: number) => unitSystem === 'imperial' ? kgToLbs(kg) : kg,
    toStoreWeight:   (v: number)  => parseWeightToKg(v, unitSystem),
    // Length
    displayLength:   (cm: number) => formatLength(cm, unitSystem),
    lengthLabel:     () => lengthLabel(unitSystem),
    toDisplayLength: (cm: number) => unitSystem === 'imperial' ? cmToInches(cm) : cm,
    // Temperature
    displayTemp:     (c: number)  => formatTemperature(c, unitSystem),
    tempLabel:       () => temperatureLabel(unitSystem),
    // Date
    displayDate:     (d: Date | string) => formatDate(d, dateFormat),
    displayDateShort:(d: Date | string) => formatDateShort(d, dateFormat),
    displayDateTime: (d: Date | string) => formatDateTime(d, dateFormat),
    isImperial:      unitSystem === 'imperial',
    isMetric:        unitSystem === 'metric',
  };
}
