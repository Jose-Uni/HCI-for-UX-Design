/* NaviSense – interacciones. Una función por grupo de HU. */
'use strict';
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const ahora = () => new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
const ico = n => `<svg class="ic" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const esc = s => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function anunciar(m) { const r = $('#anuncios'); r.textContent = ''; setTimeout(() => { r.textContent = m; }, 50); }
function msg(id, texto, tipo = 'exito') { const e = $('#' + id); e.textContent = texto; e.className = 'msg msg-' + tipo; anunciar(texto); }
function setError(inp, malo) { inp.closest('.campo').classList.toggle('con-error', malo); inp.setAttribute('aria-invalid', String(malo)); }

const pref = {
  get(k, d) { try { const v = localStorage.getItem('navisense:' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('navisense:' + k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } },
  borrar() { try { Object.keys(localStorage).filter(k => k.startsWith('navisense:')).forEach(k => localStorage.removeItem(k)); } catch (e) { } }
};
const estado = { rate: pref.get('rate', 1), haptica: 1, vol: 70 };

/* ---------- Señales: voz, tono, vibración (HU-09 a 17, 19, 27) ---------- */
let ctx;
function tono(freq, pan) {
  if (!$('#sonido').checked) return;
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = freq; g.gain.value = 0.2 * (estado.vol / 100);
    if (ctx.createStereoPanner) { const s = ctx.createStereoPanner(); s.pan.value = pan; o.connect(s); s.connect(g); } else { o.connect(g); }
    g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.4);
  } catch (e) { /* audio no disponible */ }
}
function vibrar(patron) { if (navigator.vibrate) navigator.vibrate(patron.map(x => Math.round(x * estado.haptica))); }
function hablar(texto) {
  if (!$('#voz-on').checked || !('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(texto); u.lang = 'es-PE'; u.rate = estado.rate; speechSynthesis.speak(u);
}

/* ---------- Simulador de alertas ---------- */
const ESC = [
  { hu: 'HU-09', i: 'alerta', n: 'Obstáculo a la altura de la cabeza', t: 'Rama a la altura de la cabeza', v: 'Peligro. Rama a la altura de la cabeza, dos metros', c: 'peligro', vib: [90, 50, 90, 50, 90], f: 900, p: 0 },
  { hu: 'HU-10', i: 'bache', n: 'Bache o desnivel', t: 'Bache al frente', v: 'Peligro. Bache al frente, tres metros', c: 'peligro', vib: [200, 80, 200], f: 800, p: 0 },
  { hu: 'HU-11', i: 'peaton', n: 'Peatón en movimiento', t: 'Peatón por la derecha', v: 'Atención. Peatón por la derecha, un metro', c: 'peligro', vib: [60, 60, 60, 60, 60], f: 850, p: 0.8 },
  { hu: 'HU-12', i: 'cruce', n: 'Cruce peatonal', t: 'Cruce peatonal adelante', v: 'Cruce peatonal adelante. Detente en el borde', c: 'info', vib: [150, 150, 150], f: 520, p: 0 },
  { hu: 'HU-13', i: 'semaforo', n: 'Semáforo en rojo', t: 'Semáforo en rojo, espera', v: 'Semáforo en rojo. Espera', c: 'precaucion', vib: [300], f: 520, p: -0.3 },
  { hu: 'HU-16', i: 'obras', n: 'Zona de obras', t: 'Obras a la izquierda', v: 'Peligro. Obras a la izquierda, cuatro metros', c: 'peligro', vib: [400, 100, 400], f: 950, p: -0.8 },
  { hu: 'HU-17', i: 'auto', n: 'Vehículo en la acera', t: 'Auto en la acera', v: 'Peligro. Auto en la acera, a la derecha', c: 'peligro', vib: [120, 40, 120, 40, 120], f: 900, p: 0.8 },
  { hu: 'HU-36', i: 'tren', n: 'Entrada a la estación', t: 'Entrada de estación al frente', v: 'Estación de tren. Entrada al frente, a cinco metros', c: 'info', vib: [100], f: 300, p: 0 },
  { hu: 'HU-37', i: 'anden', n: 'Llegada al andén', t: 'Andén cerca, puertas al frente', v: 'Andén. Mantente lejos del borde', c: 'info', vib: [100, 100, 100], f: 300, p: 0.3 }
];
const ETIQ = { peligro: 'Peligro', precaucion: 'Precaución', info: 'Información', exito: 'Listo' };

function mostrarAlerta(e) {
  const html = `<span class="icono" aria-hidden="true">${ico(e.i)}</span><div><strong>${e.t}</strong><span class="apoyo">${ETIQ[e.c]} · pantalla, sonido y vibración</span></div>`;
  [$('#alerta-activa'), $('#tel-alerta')].forEach(el => { el.className = 'alerta alerta-' + e.c; el.innerHTML = html; el.hidden = false; });
  $('#alerta-activa').style.marginTop = 'var(--s3)';
  tono(e.f, e.p); vibrar(e.vib); hablar(e.v);
  if (e.c === 'peligro') addEvento('obstaculo', 'alerta', 'Obstáculo detectado: ' + e.t);
}
function iniciarSimulador() {
  $('#escenarios').innerHTML = ESC.map((e, k) =>
    `<button class="btn esc" data-k="${k}" aria-pressed="false"><span class="ic" aria-hidden="true">${ico(e.i)}</span><span>${e.n}</span></button>`).join('');
  $('#escenarios').addEventListener('click', ev => {
    const b = ev.target.closest('.esc'); if (!b) return;
    $$('.esc').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    mostrarAlerta(ESC[b.dataset.k]);
  });
}

/* ---------- Audio direccional y SOS (HU-19, HU-24) ---------- */
let sos = null;
function iniciarAudio() {
  const r = $('#dir');
  const txt = () => {
    const v = +r.value;
    $('#dir-txt').textContent = v < -0.2 ? 'Obstáculo a tu izquierda' : v > 0.2 ? 'Obstáculo a tu derecha' : 'Obstáculo al frente';
    $('#punto').style.left = (50 + v * 45) + '%';
  };
  r.addEventListener('input', txt); txt();
  $$('[data-dir]').forEach(b => b.addEventListener('click', () => { r.value = b.dataset.dir; txt(); tono(880, +r.value); }));
  $('#btn-dir').addEventListener('click', () => { tono(880, +r.value); vibrar([100, 50, 100]); hablar($('#dir-txt').textContent); anunciar($('#dir-txt').textContent); });
  $('#volumen').addEventListener('input', e => { estado.vol = +e.target.value; $('#vol-txt').textContent = e.target.value + ' %'; });

  const b = $('#btn-sos'), bar = $('#sos-barra'); let t0 = 0, raf = 0;
  const fin = () => { cancelAnimationFrame(raf); bar.style.width = '0'; t0 = 0; };
  const paso = () => { const p = Math.min((performance.now() - t0) / 1500, 1); bar.style.width = (p * 100) + '%'; if (p >= 1) { fin(); activarSOS(); } else raf = requestAnimationFrame(paso); };
  const ini = () => { if (t0) return; t0 = performance.now(); vibrar([50]); raf = requestAnimationFrame(paso); };
  b.addEventListener('pointerdown', ini);
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => b.addEventListener(ev, fin));
  b.addEventListener('keydown', e => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); ini(); } });
  b.addEventListener('keyup', e => { if (e.key === ' ' || e.key === 'Enter') fin(); });
  $('#btn-sos-alt').addEventListener('click', activarSOS);
}
function activarSOS() {
  if (sos) { msg('msg-sos-demo', 'Ya hay una alerta SOS activa.', 'info'); return; }
  sos = { hora: ahora() };
  addEvento('panico', 'sos', 'Alerta de pánico recibida');
  vibrar([400, 150, 400, 150, 400]); hablar('Alerta enviada a tu contacto de confianza');
  msg('msg-sos-demo', 'Alerta enviada con tu ubicación. Tu cuidador la verá en el panel.', 'exito');
  renderSOS();
}

/* ---------- Perfil, contraste, texto, voz, lugares (HU-02, 26, 27, 29) ---------- */
function aplicarPrefs() {
  const h = document.documentElement;
  h.dataset.contraste = pref.get('contraste', 'normal'); h.dataset.texto = pref.get('texto', 'normal');
  $('#contraste').checked = h.dataset.contraste === 'alto';
  $(`input[name=texto][value="${h.dataset.texto}"]`).checked = true;
  $('#rate').value = estado.rate; $('#rate-txt').textContent = (+estado.rate).toFixed(1) + '×';
  actualizarSwitches();
}
function fijarRate(v) { estado.rate = Math.min(1.6, Math.max(0.6, +v)); pref.set('rate', estado.rate); aplicarPrefs(); }
let lugares = pref.get('lugares', ['Casa', 'Hospital']);
function renderLugares() {
  $('#lista-lugares').innerHTML = lugares.length
    ? lugares.map((l, i) => `<li><span>${ico('pin')} ${esc(l)}</span><button class="btn btn-secundario" data-del="${i}" aria-label="Quitar ${esc(l)}">Quitar</button></li>`).join('')
    : '<li class="apoyo">Aún no guardaste lugares. Agrega el primero.</li>';
}
function iniciarPerfil() {
  $('#contraste').addEventListener('change', e => { pref.set('contraste', e.target.checked ? 'alto' : 'normal'); aplicarPrefs(); });
  $$('input[name=texto]').forEach(r => r.addEventListener('change', () => { pref.set('texto', r.value); aplicarPrefs(); }));
  $('#perfil').addEventListener('change', e => {
    const P = { ciego: ['normal', 'normal', 1.2], baja: ['alto', 'muy-grande', 0.9], leve: ['normal', 'grande', 1] }[e.target.value];
    if (!P) return;
    pref.set('contraste', P[0]); pref.set('texto', P[1]); fijarRate(P[2]);
    msg('msg-perfil', 'Perfil aplicado: contraste, tamaño de texto y velocidad de voz ajustados.');
  });
  $('#rate').addEventListener('input', e => fijarRate(e.target.value));
  $$('[data-rate]').forEach(b => b.addEventListener('click', () => fijarRate(estado.rate + +b.dataset.rate)));
  $('#haptica').addEventListener('change', e => { estado.haptica = +e.target.value; });
  $('#probar-voz').addEventListener('click', () => { hablar('Así sonará tu guía de voz'); anunciar('Probando la voz'); });
  $('#probar-vib').addEventListener('click', () => { vibrar([200, 100, 200]); anunciar(navigator.vibrate ? 'Vibración enviada' : 'Este dispositivo no tiene vibración'); });

  $('#form-lugar').addEventListener('submit', e => {
    e.preventDefault(); const i = $('#lugar'), v = i.value.trim();
    if (!v) { msg('msg-lugar', 'Escribe el nombre del lugar antes de guardar.', 'error'); i.focus(); return; }
    lugares.push(v); pref.set('lugares', lugares); i.value = ''; renderLugares(); msg('msg-lugar', `Guardaste «${v}».`);
  });
  $('#lista-lugares').addEventListener('click', e => {
    const b = e.target.closest('[data-del]'); if (!b) return;
    const [q] = lugares.splice(+b.dataset.del, 1); pref.set('lugares', lugares); renderLugares(); msg('msg-lugar', `Quitaste «${q}».`, 'info');
  });
}

/* Interruptores con texto Activado / Desactivado */
function actualizarSwitches() {
  $$('[data-switch]').forEach(i => {
    const est = i.parentElement.querySelector('.est'); if (est) est.textContent = i.checked ? 'Activado' : 'Desactivado';
  });
}

/* ---------- Panel del cuidador ---------- */
const eventos = [
  { t: '09:41', tipo: 'estado', i: 'peaton', x: 'En tránsito · Calle Mayor 18' },
  { t: '09:32', tipo: 'perimetro', i: 'escudo', x: 'Entrada en zona segura: Casa' }
];
let filtro = 'todos';
function addEvento(tipo, i, x) { eventos.unshift({ t: ahora(), tipo, i, x }); renderEventos(); }
function renderEventos() {
  const li = e => `<li><span>${ico(e.i)} ${esc(e.x)}</span><span class="apoyo">${e.t}</span></li>`;
  $('#lista-eventos').innerHTML = eventos.slice(0, 4).map(li).join('');
  const l = eventos.filter(e => filtro === 'todos' || e.tipo === filtro);
  $('#lista-historial').innerHTML = l.length ? l.map(li).join('') : '<li class="apoyo">No hay eventos de este tipo.</li>';
}
function renderSOS() {
  const card = $('#sos-card'), ban = $('#banner-sos');
  if (!sos) { card.innerHTML = '<p>No hay alertas de pánico activas.</p>'; ban.innerHTML = ''; return; }
  card.innerHTML = `<div class="alerta alerta-peligro"><span class="icono" aria-hidden="true">${ico('sos')}</span><div><strong>SOS recibido</strong><span class="apoyo">Hoy, ${sos.hora} · Calle Mayor 18</span></div></div>
    <div class="fila" style="margin-top:var(--s2)"><button class="btn btn-principal" data-sos="llamar">Llamar a Carlos</button><button class="btn btn-secundario" data-sos="atendida">Marcar como atendida</button></div>`;
  ban.innerHTML = `<div class="alerta alerta-peligro" style="margin-bottom:var(--s3)"><span class="icono" aria-hidden="true">${ico('sos')}</span><div><strong>Carlos pidió ayuda</strong><span class="apoyo">Revisa la pestaña Alertas y zona segura</span></div></div>`;
}
function iniciarTabs() {
  const tabs = $$('[role=tab]');
  const HU = { 'tab-resumen': 'HU-08 · HU-23 · HU-31', 'tab-alertas': 'HU-32 · HU-33 · HU-34 · HU-35', 'tab-personas': 'HU-06', 'tab-config': 'HU-04 · HU-05 · HU-22 · HU-46 · HU-47' };
  const sel = t => { $('#app-pie').textContent = 'Panel cuidador · Web · ' + HU[t.id]; tabs.forEach(x => { const on = x === t; x.setAttribute('aria-selected', String(on)); x.tabIndex = on ? 0 : -1; $('#' + x.getAttribute('aria-controls')).hidden = !on; }); t.focus(); };
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => sel(t));
    t.addEventListener('keydown', e => {
      if ((e.key === 'ArrowRight' || e.key === 'ArrowDown')) sel(tabs[(i + 1) % tabs.length]);
      if ((e.key === 'ArrowLeft' || e.key === 'ArrowUp')) sel(tabs[(i - 1 + tabs.length) % tabs.length]);
    });
  });
}
function topSesion(on) {
  $('#btn-salir').hidden = !on; $('#top-user').hidden = !on; $('#btn-ayuda').hidden = on;
  $('#app-pie').textContent = on ? 'Panel cuidador · Web · HU-08 · HU-23 · HU-31' : 'Panel cuidador · Web · HU-03 · HU-48';
}
function iniciarLogin() {
  const rec = pref.get('email', ''); if (rec) $('#email').value = rec;
  $('#ver-clave').addEventListener('click', e => { const c = $('#clave'), ver = c.type === 'password'; c.type = ver ? 'text' : 'password'; e.currentTarget.setAttribute('aria-pressed', String(ver)); e.currentTarget.setAttribute('aria-label', ver ? 'Ocultar contraseña' : 'Mostrar contraseña'); });
  $('#olvide').addEventListener('click', e => { e.preventDefault(); msg('msg-login', 'Te enviaremos un enlace al correo registrado para crear una contraseña nueva.', 'info'); });
  $('#btn-ayuda').addEventListener('click', () => msg('msg-login', 'Usa el correo y la contraseña de tu cuenta de acompañante. Si no los recuerdas, elige «¿Olvidaste tu contraseña?».', 'info'));
  $('#form-login').addEventListener('submit', e => {
    e.preventDefault(); const em = $('#email'), pw = $('#clave');
    const okE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em.value.trim()), okP = pw.value.length >= 6;
    setError(em, !okE); setError(pw, !okP);
    if (!okE || !okP) { (okE ? pw : em).focus(); anunciar('Revisa los campos marcados.'); return; }
    if ($('#recordar').checked) pref.set('email', em.value.trim()); $('#login-vista').hidden = true; $('#panel-vista').hidden = false; topSesion(true); $('#t-panel-sesion').focus(); anunciar('Sesión iniciada. Panel de Carlos López.');
    renderSOS(); renderEventos(); renderResumen();
  });
  $('#btn-salir').addEventListener('click', () => {
    pref.borrar(); lugares = []; renderLugares();
    $('#panel-vista').hidden = true; $('#login-vista').hidden = false; topSesion(false); $('#form-login').reset(); $('#email').focus();
    anunciar('Sesión cerrada. Se borraron los datos locales de ubicación.');
  });
}
let bat = 85;
function renderResumen() {
  $('#bat').textContent = bat + '%'; const bajo = bat <= 20;
  $('#bat-chip').innerHTML = ico('bateria') + ' ' + (bajo ? 'Batería baja' : 'Batería normal'); $('#bat-chip').className = 'chip ' + (bajo ? 'chip-precaucion' : 'chip-exito');
  const c = $('#compartir').checked; $('#pin').hidden = !c;
  $('#estado-ubic').textContent = c ? `Ubicación compartida con permiso de Carlos. Actualizada a las ${ahora()}` : 'Compartir ubicación en pausa.';
}
function iniciarResumen() {
  $('#btn-actualizar').addEventListener('click', () => {
    bat = Math.max(5, bat - Math.ceil(Math.random() * 8));
    $('#pin').style.left = (25 + Math.random() * 50) + '%'; $('#pin').style.top = (35 + Math.random() * 45) + '%';
    if (bat <= 20) addEvento('estado', 'bateria', 'Batería baja en el celular de Carlos');
    renderResumen(); anunciar(`Estado actualizado. Batería ${bat} por ciento.`);
  });
  $('#compartir').addEventListener('change', renderResumen);
}
function iniciarAlertas() {
  $('#sos-card').addEventListener('click', e => {
    const b = e.target.closest('[data-sos]'); if (!b) return;
    if (b.dataset.sos === 'llamar') { msg('msg-sos', 'Llamando a Carlos…', 'info'); return; }
    addEvento('panico', 'check', 'SOS atendido'); sos = null; renderSOS(); msg('msg-sos', 'Marcaste la alerta como atendida.');
    msg('msg-sos-demo', '', 'info');
  });
  const r = $('#radio'), n = $('#radio-n'), c = $('#geo-circulo');
  const fijar = v => { r.value = v; n.value = v; $('#radio-txt').textContent = v + ' m'; c.style.width = c.style.height = (20 + (v - 100) / 1900 * 70) + '%'; };
  r.addEventListener('input', () => fijar(r.value));
  n.addEventListener('input', () => { if (n.value >= 100 && n.value <= 2000) fijar(n.value); });
  fijar(500);
  $('#guardar-geo').addEventListener('click', () => {
    if (!(n.value >= 100 && n.value <= 2000)) { msg('msg-geo', 'El radio debe estar entre 100 y 2000 metros.', 'error'); n.focus(); return; }
    msg('msg-geo', `Perímetro guardado: ${n.value} m. Recibirás un aviso si Carlos sale de la zona.`);
  });
  $('#simular-salida').addEventListener('click', () => {
    addEvento('perimetro', 'escudo', 'Carlos salió del perímetro seguro');
    msg('msg-geo', `Aviso: Carlos salió del perímetro de ${r.value} m.`, 'precaucion');
  });
  $$('[data-filtro]').forEach(b => b.addEventListener('click', () => {
    filtro = b.dataset.filtro; $$('[data-filtro]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); renderEventos();
  }));
  $('#form-notif').addEventListener('submit', e => {
    e.preventDefault();
    if (!$$('[name=canal]:checked').length) { msg('msg-notif', 'Elige al menos un canal para recibir los avisos críticos.', 'error'); return; }
    msg('msg-notif', 'Canales guardados. Las alertas de pánico llegarán por ' + $$('[name=canal]:checked').length + ' canal(es).');
  });
}
let contactos = [];
function iniciarPersonas() {
  $('#form-vinculo').addEventListener('submit', e => {
    e.preventDefault(); const i = $('#codigo'), ok = /^NS-\d{6}$/i.test(i.value.trim()); setError(i, !ok);
    if (!ok) { i.focus(); anunciar('Código con formato incorrecto.'); return; }
    $('#lista-personas').insertAdjacentHTML('beforeend', `<li><span>${ico('info')} ${esc(i.value.toUpperCase())} · Esperando aceptación</span></li>`);
    i.value = ''; msg('msg-vinculo', 'Solicitud enviada. El vínculo se activa cuando la persona la acepte en su móvil.');
  });
  $('#form-contacto').addEventListener('submit', e => {
    e.preventDefault(); const n = $('#c-nombre'), c = $('#c-cel'), okN = n.value.trim().length > 0, okC = /^9\d{8}$/.test(c.value.trim());
    setError(n, !okN); setError(c, !okC); if (!okN || !okC) { (okN ? c : n).focus(); return; }
    contactos.push({ n: n.value.trim(), c: c.value.trim() }); n.value = c.value = ''; renderContactos(); msg('msg-contacto', 'Contacto agregado.');
  });
  $('#lista-contactos').addEventListener('click', e => {
    const b = e.target.closest('[data-del]'); if (!b) return; contactos.splice(+b.dataset.del, 1); renderContactos(); msg('msg-contacto', 'Contacto quitado.', 'info');
  });
  renderContactos();
  let confirmar = false; const d = $('#desvincular');
  d.addEventListener('click', () => {
    if (!confirmar) { confirmar = true; d.textContent = 'Confirmar desvinculación'; msg('msg-desv', 'Dejarás de recibir alertas de Carlos. Pulsa de nuevo para confirmar.', 'precaucion'); return; }
    confirmar = false; d.textContent = 'Desvincular'; msg('msg-desv', 'Te desvinculaste de Carlos López.', 'info');
  });
}
function renderContactos() {
  $('#lista-contactos').innerHTML = contactos.length
    ? contactos.map((c, i) => `<li><span>${ico('telefono')} ${esc(c.n)} · ${esc(c.c)}</span><button class="btn btn-secundario" data-del="${i}" aria-label="Quitar a ${esc(c.n)}">Quitar</button></li>`).join('')
    : '<li class="apoyo">Aún no agregaste contactos de emergencia.</li>';
}
function iniciarConfig() {
  $('#c-vol').addEventListener('input', e => { $('#c-vol-txt').textContent = e.target.value + ' %'; });
  $('#form-config').addEventListener('submit', e => {
    e.preventDefault();
    msg('msg-config', `Preferencias guardadas a las ${ahora()} Sensibilidad ${$('[name=sens]:checked').value.toLowerCase()}, volumen ${$('#c-vol').value} %.`);
  });
  const nube = () => { $('#nube-txt').textContent = $('#nube').checked ? `Copia actualizada hoy a las ${ahora()}` : 'Sin respaldo: si cambias de teléfono perderás tus rutas favoritas.'; };
  $('#nube').addEventListener('change', nube); nube();
  $('#llegada').addEventListener('change', () => anunciar($('#llegada').checked ? 'Aviso de llegada activado' : 'Aviso de llegada desactivado'));
  $('#enviar-guia').addEventListener('click', () => msg('msg-guia', 'Guía de calibración enviada al celular de Carlos.'));
}

function iniciarMenu() {
  const b = $('#nav-toggle'), nav = $('#nav');
  b.addEventListener('click', () => { const a = nav.classList.toggle('abierto'); b.setAttribute('aria-expanded', String(a)); });
  $$('a', nav).forEach(a => a.addEventListener('click', () => { nav.classList.remove('abierto'); b.setAttribute('aria-expanded', 'false'); }));
}

document.addEventListener('DOMContentLoaded', () => {
  document.addEventListener('change', e => { if (e.target.matches('[data-switch]')) actualizarSwitches(); });
  iniciarMenu(); iniciarSimulador(); iniciarAudio(); iniciarPerfil(); renderLugares(); aplicarPrefs();
  iniciarLogin(); iniciarTabs(); iniciarResumen(); iniciarAlertas(); iniciarPersonas(); iniciarConfig();
  renderEventos(); renderSOS();
});
