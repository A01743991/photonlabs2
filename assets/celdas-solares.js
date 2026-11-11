'use strict';

// Readings from paired voltage/current photographs in the supplied orientation order.
const solarMeasurements = [
  {name:'Viendo para abajo', voltage:8.94, current:-2.22, unit:'mA', amps:-0.00222, pose:'translate(282 206) matrix(1 .12 -.42 .55 0 0)', caption:'Cara activa orientada hacia el suelo.', note:'Se conserva el signo negativo visible en la fotografía de corriente.'},
  {name:'Viendo para arriba', voltage:19.83, current:26.9, unit:'µA', amps:0.0000269, pose:'translate(282 206) matrix(1 .12 -.42 .55 0 0)', caption:'Cara activa orientada hacia el cielo.', note:'La fotografía muestra 26.9 µA, equivalentes a 0.0000269 A.'},
  {name:'Perpendicular al sol', voltage:19.34, current:3.52, unit:'mA', amps:0.00352, pose:'translate(300 207) rotate(50)', caption:'Cara activa perpendicular a la dirección de los rayos solares.', note:'La fotografía muestra 3.52 mA, equivalentes a 0.003520 A.'},
];
const solarSigned = (value, decimals) => (value < 0 ? '−' : '') + Math.abs(value).toFixed(decimals);
const solarAmpText = value => solarSigned(value, Math.abs(value) < 0.0001 ? 7 : 6) + ' A';

function selectSolarPosition(index) {
  const measurement = solarMeasurements[index];
  document.getElementById('solar-position-name').textContent = measurement.name;
  document.getElementById('solar-voltage').textContent = measurement.voltage.toFixed(2);
  document.getElementById('solar-current').textContent = solarSigned(measurement.current, measurement.unit === 'µA' ? 1 : 2);
  document.getElementById('solar-current-unit').textContent = ' ' + measurement.unit;
  document.getElementById('solar-current-amps').textContent = solarAmpText(measurement.amps);
  document.getElementById('solar-reading-note').textContent = measurement.note;
  document.getElementById('solar-scene-title').textContent = measurement.name;
  document.getElementById('solar-scene-desc').textContent = measurement.caption;
  document.getElementById('solar-pose-caption').textContent = measurement.caption;
  document.getElementById('solar-panel-pose').setAttribute('transform', measurement.pose);
  document.getElementById('solar-panel-face').setAttribute('fill',index === 0 ? '#d5dfe6' : 'url(#solar-cell-pattern)');
  document.getElementById('solar-panel-back').style.display = index === 0 ? '' : 'none';
  for (const button of document.querySelectorAll('[data-solar-position]')) {
    button.setAttribute('aria-pressed',String(Number(button.dataset.solarPosition) === index));
  }
  for (const row of document.querySelectorAll('#solar-measurements tr')) {
    row.classList.toggle('solar-selected-row',Number(row.dataset.position) === index);
  }
}
document.getElementById('solar-measurements').innerHTML = solarMeasurements.map((measurement,index) =>
  `<tr data-position="${index}"><th scope="row">${measurement.name}</th><td>${measurement.voltage.toFixed(2)} V</td><td>${solarSigned(measurement.current,measurement.unit === 'µA' ? 1 : 2)} ${measurement.unit}</td><td>${solarAmpText(measurement.amps)}</td></tr>`
).join('');
for (const button of document.querySelectorAll('[data-solar-position]')) {
  button.addEventListener('click',() => selectSolarPosition(Number(button.dataset.solarPosition)));
}
selectSolarPosition(0);
