'use strict';
(() => {
  const el = id => document.getElementById(id);
  const format = n => new Intl.NumberFormat('es-MX', {maximumFractionDigits:1}).format(n);
  let step = 0, example = false;
  const number = (id, min, max, integer = false) => {
    const field = el(id), value = Number(field.value);
    return field.value.trim() !== '' && Number.isFinite(value) && value >= min && value <= max && (!integer || Number.isInteger(value)) ? value : null;
  };
  function data() {
    const days = el('period').value === 'custom' ? number('days', 1, 366, true) : Number(el('period').value);
    const kwh = el('no-bill').checked ? null : number('consumption', 0, 100000);
    const coverage = Number(document.querySelector('[name=coverage]:checked').value) / 100;
    const goal = document.querySelector('[name=goal]:checked').value;
    const watts = number('module-watts', 100, 1000, true);
    const target = kwh === null ? null : kwh * coverage;
    const low = target !== null && days ? target / (days * 6 * .8) : null;
    const high = target !== null && days ? target / (days * 4 * .8) : null;
    return {days, kwh, coverage, goal, watts, target, low, high, tariff:el('tariff').value, roof:el('roof').value, city:el('city').value.trim(), ownership:el('ownership').value};
  }
  function showStep(next) {
    step = next;
    document.querySelectorAll('[data-step]').forEach(section => {section.hidden = Number(section.dataset.step) !== step;});
    document.querySelectorAll('.steps li').forEach((item, i) => {if (i === step) item.setAttribute('aria-current','step'); else item.removeAttribute('aria-current');});
    el('side-tip').textContent = ['Ten a la mano un recibo reciente. Con los kWh y el periodo podemos poner tu consumo en contexto.','Primero tu objetivo; después los equipos. Respaldo y reducción del recibo necesitan propuestas diferentes.','Una buena cotización explica equipos, alcances, impuestos y garantías. Lleva contigo este resumen.'][step];
    el('request').hidden = step !== 2;
    if (step === 2) render();
    el('step-title-' + step).focus({preventScroll:true});
    el('planner-title').closest('.planner').scrollIntoView({behavior:'smooth',block:'start'});
  }
  function render() {
    const d = data(), available = d.kwh !== null && d.days !== null;
    el('energy-result').hidden = !available;
    el('no-data-result').hidden = available;
    el('result-intro').textContent = example ? 'Estás usando un ejemplo de 600 kWh en 60 días. Cámbialo por tu recibo para personalizar el escenario.' : available ? `Partimos de ${format(d.kwh)} kWh en ${d.days} días. No hemos revisado tu instalación ni el historial anual.` : 'Tu solicitud puede avanzar aunque todavía falte el recibo.';
    const advice = [];
    if (available) {
      const remaining = d.kwh - d.target;
      el('before-energy').textContent = `${format(d.kwh)} kWh del periodo`;
      el('after-energy').textContent = `${format(remaining)} kWh netos por cubrir`;
      el('solar-bar').style.width = (d.coverage * 100) + '%';
      el('grid-bar').style.width = (100 - d.coverage * 100) + '%';
      el('solar-legend').textContent = `Meta solar: ${format(d.target)} kWh`;
      el('grid-legend').textContent = `Balance restante: ${format(remaining)} kWh`;
      if (d.kwh === 0) {
        el('size-result').textContent = 'Revisemos otros periodos';
        el('size-explanation').textContent = 'Con un periodo de 0 kWh no proponemos paneles. Comprueba que copiaste el consumo correcto y revisa el historial anual.';
      } else if (d.roof === 'heavy') {
        el('size-result').textContent = 'Primero, revisar las sombras';
        el('size-explanation').textContent = 'Con sombra buena parte del día no mostramos un número de paneles como referencia de compra. Hace falta evaluar si existe otra superficie útil.';
      } else {
        el('size-result').textContent = d.watts ? `${Math.ceil(d.low * 1000 / d.watts)}–${Math.ceil(d.high * 1000 / d.watts)} paneles de ejemplo` : 'Revisa la potencia de referencia';
        el('size-explanation').textContent = d.watts ? 'Un punto de partida para explorar tu meta. Falta revisar sol, sombras, equipos y espacio útil del techo antes de elegir una cantidad.' : 'Revisa la potencia de referencia dentro de los datos técnicos para ver el número orientativo de paneles.';
      }
      const technical = document.createElement('p');
      technical.textContent = `Consumo medio del periodo: ${format(d.kwh / d.days)} kWh/día. Meta solar: ${format(d.target)} kWh en ${d.days} días (${format(d.coverage * 100)}%). Rango matemático de capacidad: ${format(d.low)}–${format(d.high)} kWp antes de verificar el sitio. No incluye una evaluación de capacidad de azotea. ${d.watts === null ? "Completa una potencia válida para ver la energía de un panel." : `Un panel de ejemplo de ${d.watts} Wp produciría ${format(d.watts / 1000 * 4 * .8 * d.days)}–${format(d.watts / 1000 * 6 * .8 * d.days)} kWh en el mismo periodo bajo esos supuestos; no es una medición local.`}`;
      el('technical-result').replaceChildren(technical);
    } else el('technical-result').textContent = 'Consumo y tamaño: pendientes del recibo. No se han supuesto kWh a partir de un pago en pesos.';
    el('module-error').textContent = d.watts === null ? 'Usa una potencia entera entre 100 y 1,000 Wp.' : '';
    if (d.goal === 'backup') advice.push('Tu prioridad es el respaldo: solicita una evaluación de baterías, inversor compatible, equipos esenciales y horas de autonomía. El rango solar no dimensiona esa batería.');
    else if (d.goal === 'help') advice.push('Tu siguiente paso es una revisión de recibos y techo. Puedes pedir que te expliquen las alternativas antes de elegir equipos.');
    else advice.push('Para reducir tu recibo, estudia primero el sistema conectado a CFE y la tarifa aplicable. Añade batería si también necesitas respaldo y la evaluación lo justifica.');
    if (d.tariff === 'DAC') advice.push('Tu recibo indica DAC. Revisa el historial de 365 días con el asesor: no podemos prometer una salida de DAC con un solo periodo.');
    else if (d.tariff === 'business' || el('project-type').value !== 'Hogar') advice.push('El proyecto comercial o empresarial necesita revisar su tarifa y, cuando corresponda, demanda y horarios. Las referencias domésticas no se deben aplicar directamente.');
    else if (d.tariff === 'unknown') advice.push('Falta confirmar tu tarifa de CFE. Puedes continuar; ese dato será necesario para estimar el ahorro en pesos.');
    else advice.push(`Registramos tarifa ${d.tariff}. El ahorro en pesos requiere revisar bloques, temporada y cargos de tu recibo; la meta de energía no es un descuento en la factura.`);
    if (d.roof === 'partial' || d.roof === 'heavy') advice.push('Hay sombras por revisar: pide un análisis antes de aceptar una cantidad o producción de paneles.');
    if (d.roof === 'unknown') advice.push('Queda pendiente revisar sombras y superficie útil. El tamaño de ejemplo no confirma espacio disponible.');
    if (d.ownership !== 'own') advice.push('Confirma el permiso para usar la azotea antes de contratar una instalación.');
    el('personal-advice').replaceChildren(...advice.map(message => {const p = document.createElement('p'); p.textContent = message; return p;}));
  }
  document.querySelectorAll('[data-next]').forEach(button => button.addEventListener('click', () => {
    if (step === 0) {
      const d = data();
      const error = !el('no-bill').checked && d.kwh === null ? 'Copia un consumo entre 0 y 100,000 kWh, o elige continuar sin recibo.' : !el('no-bill').checked && d.days === null ? 'Indica un número entero de días entre 1 y 366.' : '';
      el('error-0').textContent = error;
      el('consumption').setAttribute('aria-invalid',String(!el('no-bill').checked && d.kwh === null));
      if (error) {el(d.kwh === null ? 'consumption' : 'days').focus(); return;}
    }
    showStep(step + 1);
  }));
  document.querySelectorAll('[data-back]').forEach(button => button.addEventListener('click', () => showStep(step - 1)));
  el('planner-form').addEventListener('submit', event => {event.preventDefault(); const next = document.querySelector(`[data-step="${step}"] [data-next]`); if(next) next.click();});
  el('period').addEventListener('change', () => {el('custom-days-field').hidden = el('period').value !== 'custom'; example = false; el('example-label').hidden = true;});
  function toggleBill() {const disabled = el('no-bill').checked; ['consumption','period','days','tariff'].forEach(id => {el(id).disabled = disabled;}); el('error-0').textContent = ''; el('consumption').removeAttribute('aria-invalid');}
  el('no-bill').addEventListener('change', () => {toggleBill(); example = false; el('example-label').hidden = true;});
  el('use-example').addEventListener('click', () => {el('no-bill').checked = false; toggleBill(); el('consumption').value = '600'; el('period').value = '60'; el('tariff').value = 'unknown'; el('custom-days-field').hidden = true; example = true; el('example-label').hidden = false;});
  ['consumption','days'].forEach(id => el(id).addEventListener('input', () => {example = false; el('example-label').hidden = true;}));
  document.querySelectorAll('[name=goal]').forEach(field => field.addEventListener('change', () => {el('goal-tip').textContent = data().goal === 'backup' ? 'Sugerencia: piensa qué equipos son esenciales y cuántas horas necesitas mantenerlos. Tener paneles por sí solo no garantiza luz durante un apagón.' : 'Sugerencia: empieza con el consumo de todo un año antes de elegir cuántos paneles comprar.';}));
  document.querySelectorAll('[name=coverage]').forEach(field => field.addEventListener('change', render));
  el('module-watts').addEventListener('input', render);
  const situations = {
    day:['Usa el sol mientras está disponible.','Los paneles aportan energía a tu casa. Si no alcanza, la red puede completar la diferencia. Los excedentes pueden ir a la red conforme a tu contrato de interconexión.'],
    night:['De noche, la red sigue siendo importante.','Los paneles no generan sin sol. Sin batería, tu casa toma energía de la red. En medición neta pueden aplicarse créditos conforme al contrato; eso no significa que el panel genere durante la noche.'],
    outage:['Paneles no significa respaldo automático.','Un sistema interconectado convencional se desconecta ante un corte de red por seguridad. Para mantener equipos encendidos necesitas una solución de respaldo diseñada y compatible.']
  };
  document.querySelectorAll('[data-flow]').forEach(button => button.addEventListener('click', () => {
    const key = button.dataset.flow;
    document.querySelectorAll('[data-flow]').forEach(other => other.setAttribute('aria-pressed',String(other === button)));
    el('flow-title').textContent = situations[key][0]; el('flow-text').textContent = situations[key][1];
    el('line-solar').classList.toggle('inactive',key !== 'day'); el('line-grid').classList.toggle('inactive',key === 'outage');
    el('flow-sun').style.opacity = key === 'day' ? '1' : '.4';
  }));
  function summary() {
    const d = data();
    const labels = {saving:'Reducir recibo',backup:'Respaldo en apagones',help:'Recibir orientación'};
    return ['PHOTON LABS · Solicitud preliminar',example ? 'DATOS DE EJEMPLO: sustituir por el recibo real antes de cotizar.' : 'Datos indicados por el visitante.',`Proyecto: ${el('project-type').value}`,`Ciudad y estado: ${d.city || 'Pendiente'}`,`Objetivo: ${labels[d.goal]}`,`Consumo: ${d.kwh === null ? 'Pendiente' : `${d.kwh} kWh en ${d.days} días`}`,`Tarifa CFE: ${d.tariff === 'unknown' ? 'Pendiente' : d.tariff === 'business' ? 'Comercial / otra' : d.tariff}`,...(d.kwh !== null ? [`Meta de energía solar: ${d.coverage * 100}% (${format(d.target)} kWh del periodo). No equivale al ahorro en pesos.`,el('size-result').textContent,el('size-explanation').textContent,'Supuestos: 4–6 horas sol pico y factor global 80%. Sin datos de radiación local; no es un diseño de instalación.'] : []),`Sombras: ${el('roof').selectedOptions[0].textContent}`,`Uso de azotea: ${el('ownership').selectedOptions[0].textContent}`,'',...Array.from(el('personal-advice').children,p=>p.textContent),'','Solicito desglose de equipos, generación anual y supuestos, instalación, protecciones, interconexión, garantías, impuestos y precio total.','Precio y ahorro en pesos: pendientes de evaluación.'].join('\n');
  }
  el('download-summary').addEventListener('click', () => {const url = URL.createObjectURL(new Blob([summary()],{type:'text/plain;charset=utf-8'})); const a = document.createElement('a'); a.href = url; a.download = 'Photon-Labs-mi-proyecto-solar.txt'; a.click(); setTimeout(() => URL.revokeObjectURL(url),1000);});
  el('contact-form').addEventListener('submit', event => {
    event.preventDefault();
    if(!el('contact-form').reportValidity()) return;
    const body = summary() + `\n\nNombre: ${el('contact-name').value.trim()}\nCorreo: ${el('contact-email').value.trim()}\nComentarios: ${el('comments').value.trim() || 'Sin comentarios'}`;
    window.location.href = 'mailto:contacto@photonlabs.mx?subject=' + encodeURIComponent('Mi proyecto solar · Photon Labs') + '&body=' + encodeURIComponent(body);
    el('contact-status').textContent = 'Se solicitó abrir tu aplicación de correo. Revisa y envía el mensaje allí. Si no se abre, descarga el resumen y escríbenos a contacto@photonlabs.mx.';
  });
})();
