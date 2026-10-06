// ELEMENTOS DEL DOM
const miIdentificadorInput = document.getElementById('miIdentificador');
const conectarBtn = document.getElementById('conectarBtn');
const tuIdSpan = document.getElementById('tuId');
const idDestinoInput = document.getElementById('idDestino');
const enlazarBtn = document.getElementById('enlazarBtn');
const listaConectados = document.getElementById('listaConectados');
const contador = document.getElementById('contador');
const pendientesInfo = document.getElementById('pendientesInfo');
const mensajeInput = document.getElementById('mensajeInput');
const publicarBtn = document.getElementById('publicarBtn');
const muro = document.getElementById('muro');
const grabarBtn = document.getElementById('grabarBtn');
const detenerBtn = document.getElementById('detenerBtn');
const enviarAudioBtn = document.getElementById('enviarAudioBtn');
const llamarBtn = document.getElementById('llamarBtn');
const colgarBtn = document.getElementById('colgarBtn');
const responderBtn = document.getElementById('responderBtn');
const rechazarBtn = document.getElementById('rechazarBtn');
const estadoConexion = document.getElementById('estadoConexion');
const llamadaEnCurso = document.getElementById('llamadaEnCurso');
const llamadaEntrante = document.getElementById('llamadaEntrante');
const quienLlama = document.getElementById('quienLlama');
const estadoLlamada = document.getElementById('estadoLlamada');
const audioRemoto = document.getElementById('audioRemoto');

let peer;
let conexiones = [];
let miId = '';
let grabadora;
let datosAudioBlob = null;
let baseDatos;
let llamadaActiva = null;
let flujoLocal = null;

// ==============================================
// PASO 1: INDEXEDDB — GUARDADO PERMANENTE LOCAL
// ==============================================
function iniciarBaseDatos() {
  return new Promise((resolver, rechazar) => {
    const solicitud = indexedDB.open('RedDescentralizada', 2);
    
    solicitud.onupgradeneeded = (e) => {
      baseDatos = e.target.result;
      if (!baseDatos.objectStoreNames.contains('identidad')) {
        baseDatos.createObjectStore('identidad');
      }
      if (!baseDatos.objectStoreNames.contains('mensajes')) {
        const msgs = baseDatos.createObjectStore('mensajes', { autoIncrement: true });
        msgs.createIndex('para', 'para', { unique: false });
        msgs.createIndex('de', 'de', { unique: false });
        msgs.createIndex('entregado', 'entregado', { unique: false });
      }
    };

    solicitud.onsuccess = (e) => {
      baseDatos = e.target.result;
      resolver();
    };
    solicitud.onerror = rechazar;
  });
}

// Guardar y recuperar tu número
async function guardarIdentidad(numero) {
  return new Promise(resolver => {
    const tx = baseDatos.transaction('identidad', 'readwrite');
    tx.objectStore('identidad').put(numero, 'miNumero');
    tx.oncomplete = resolver;
  });
}

async function recuperarIdentidad() {
  return new Promise(resolver => {
    const tx = baseDatos.transaction('identidad');
    const solicitud = tx.objectStore('identidad').get('miNumero');
    solicitud.onsuccess = () => resolver(solicitud.result || '');
  });
}

// Mensajes: guardar, leer, marcar como entregados
async function guardarMensaje(datos) {
  return new Promise(resolver => {
    const tx = baseDatos.transaction('mensajes', 'readwrite');
    tx.objectStore('mensajes').put({ ...datos, fecha: Date.now() });
    tx.oncomplete = resolver;
  });
}

async function leerMensajes() {
  return new Promise(resolver => {
    const tx = baseDatos.transaction('mensajes');
    const todos = tx.objectStore('mensajes').getAll();
    todos.onsuccess = () => resolver(todos.result);
  });
}

async function marcarEntregado(id) {
  return new Promise(resolver => {
    const tx = baseDatos.transaction('mensajes', 'readwrite');
    const solicitud = tx.objectStore('mensajes').get(id);
    solicitud.onsuccess = () => {
      const dato = solicitud.result;
      dato.entregado = true;
      tx.objectStore('mensajes').put(dato, id);
    };
    tx.oncomplete = resolver;
  });
}

async function leerPendientesPara(destino) {
  const todos = await leerMensajes();
  return todos.filter(m => m.para === destino && !m.entregado);
}

// ==============================================
// PASO 2: CARGAR AL INICIAR + IDENTIDAD PERMANENTE
// ==============================================
async function iniciarTodo() {
  await iniciarBaseDatos();
  
  // Recuperar número guardado
  const numeroGuardado = await recuperarIdentidad();
  if (numeroGuardado) {
    miIdentificadorInput.value = numeroGuardado;
  }

  // Cargar historial en pantalla
  const historial = await leerMensajes();
  historial.sort((a, b) => a.fecha - b.fecha);
  historial.forEach(m => {
    if (m.tipo === 'texto') {
      agregarMensajeUI(m.de, m.texto, m.de === miId, m.entregado);
    } else if (m.tipo === 'audio') {
      agregarAudioUI(m.de, m.datos, m.de === miId, m.entregado);
    }
  });
}

iniciarTodo();

// ==============================================
// PASO 3: CONEXIÓN CON NÚMERO PERMANENTE
// ==============================================
conectarBtn.addEventListener('click', async () => {
  miId = miIdentificadorInput.value.trim();
  
  if (!miId) {
    alert('Escribe tu número primero');
    return;
  }

  // Guardar para siempre
  await guardarIdentidad(miId);

  // Conectar con NUESTRO número como ID
  peer = new Peer(miId);

  peer.on('open', async (idAsignado) => {
    miId = idAsignado;
    tuIdSpan.textContent = idAsignado;
    conectarBtn.disabled = true;
    conectarBtn.textContent = '✅ Conectado';
    miIdentificadorInput.disabled = true;
    estadoConexion.innerHTML = '<span style="color:green">● En línea</span>';
    
    // Enviar mensajes pendientes que teníamos para otros
    await entregarPendientes();
  });

  peer.on('connection', manejarConexionEntrante);
  
  peer.on('call', manejarLlamadaEntrante);

  peer.on('error', (err) => {
    console.error('Error:', err);
    if (err.type === 'unavailable-id') {
      alert('⚠️ Este número ya está conectado en otro dispositivo. Cierra la sesión ahí primero.');
      estadoConexion.innerHTML = '<span style="color:red">● Ocupado</span>';
    } else {
      alert('Error: ' + err.type);
    }
  });
});

// ==============================================
// PASO 4: CONECTAR CON OTROS Y ENTREGAR PENDIENTES
// ==============================================
enlazarBtn.addEventListener('click', async () => {
  const destino = idDestinoInput.value.trim();
  if (!destino || !peer) return;
  
  const conn = peer.connect(destino);
  conn.on('open', async () => {
    manejarConexion(conn);
    // En cuanto se conectan → le entregamos lo que le guardamos
    await entregarPendientesA(conn, destino);
    llamarBtn.disabled = false;
    llamarBtn.dataset.destino = destino;
  });
});

async function manejarConexionEntrante(conn) {
  manejarConexion(conn);
  // Cuando alguien se conecta con nosotros → nos entrega lo que nos guardó
  conn.on('open', async () => {
    await entregarPendientesA(conn, miId);
    llamarBtn.disabled = false;
    llamarBtn.dataset.destino = conn.peer;
  });
}

function manejarConexion(conn) {
  if (conexiones.some(c => c.peerId === conn.peer)) return;
  
  conn.peerId = conn.peer;
  conexiones.push(conn);
  actualizarLista();

  conn.on('data', async (recibido) => {
    // Mensaje nuevo
    if (recibido.tipo === 'texto' || recibido.tipo === 'audio') {
      await guardarMensaje({ ...recibido, entregado: true });
      
      if (recibido.tipo === 'texto') {
        agregarMensajeUI(recibido.de, recibido.texto, false, true);
      } else {
        agregarAudioUI(recibido.de, recibido.datos, false, true);
      }
    }
    
    // Solicitud de mensajes pendientes
    if (recibido.tipo === 'solicitud-pendientes') {
      const pendientes = await leerPendientesPara(recibido.de);
      pendientes.forEach(async m => {
        conn.send({
          tipo: m.tipo,
          de: miId,
          para: recibido.de,
          texto: m.texto || null,
          datos: m.datos || null,
          esPendiente: true
        });
        await marcarEntregado(m.id);
      });
    }
  });

  conn.on('close', () => {
    conexiones = conexiones.filter(c => c.peerId !== conn.peerId);
    actualizarLista();
    llamarBtn.disabled = conexiones.length === 0;
  });
}

function actualizarLista() {
  listaConectados.innerHTML = '';
  contador.textContent = conexiones.length;
  conexiones.forEach(c => {
    const li = document.createElement('li');
    li.textContent = '🔗 ' + c.peerId;
    listaConectados.appendChild(li);
  });
}

// ==============================================
// PASO 5: MENSAJES QUE ESPERAN — EL CORAZÓN DE TODO
// ==============================================
async function entregarPendientesA(conn, destino) {
  conn.send({ tipo: 'solicitud-pendientes', de: miId, para: destino });
}

async function entregarPendientes() {
  for (const conn of conexiones) {
    await entregarPendientesA(conn, conn.peerId);
  }
}

// Enviar mensaje
publicarBtn.addEventListener('click', async () => {
  const texto = mensajeInput.value.trim();
  if (!texto || !peer) return;

  const destino = conexiones.length > 0 ? conexiones[0].peerId : null;
  if (!destino) {
    alert('Conéctate con alguien primero escribiendo su número');
    return;
  }

  const paquete = {
    tipo: 'texto',
    de: miId,
    para: destino,
    texto: texto,
    entregado: false
  };

  // Intentar enviar ahora
  let enviado = false;
  for (const conn of conexiones) {
    if (conn.peerId === destino && conn.open) {
      conn.send({ ...paquete, entregado: true });
      enviado = true;
      break;
    }
  }

  // Guardar con estado
  await guardarMensaje({ ...paquete, entregado: enviado });
  agregarMensajeUI('Tú', texto, true, enviado);
  
  mensajeInput.value = '';
  actualizarPendientesInfo();
});

function agregarMensajeUI(de, texto, esPropio, entregado) {
  const div = document.createElement('div');
  div.className = `mensaje ${esPropio ? 'propio' : ''} ${entregado ? 'entregado' : 'pendiente'}`;
  div.innerHTML = `<strong>${de}:</strong><br>${texto}${entregado ? '' : '<br><em>⌛ Pendiente de entrega</em>'}`;
  muro.prepend(div);
}

function actualizarPendientesInfo() {
  leerMensajes().then(todos => {
    const pend = todos.filter(m => m.de === miId && !m.entregado).length;
    pendientesInfo.textContent = pend > 0 ? `📦 ${pend} mensajes pendientes de entregar` : '';
  });
}

// ==============================================
// PASO 6: AUDIO — GRABAR Y ENVIAR
// ==============================================
grabarBtn.addEventListener('click', async () => {
  try {
    flujoLocal = await navigator.mediaDevices.getUserMedia({ audio: true });
    grabadora = new MediaRecorder(flujoLocal);
    datosAudioBlob = null;

    grabadora.ondataavailable = (e) => datosAudioBlob = e.data;
    grabadora.onstop = () => {
      grabarBtn.disabled = false;
      detenerBtn.disabled = true;
      enviarAudioBtn.disabled = !datosAudioBlob;
      flujoLocal.getTracks().forEach(t => t.stop());
    };

    grabadora.start();
    grabarBtn.disabled = true;
    detenerBtn.disabled = false;
  } catch {
    alert('Se necesita permiso al micrófono');
  }
});

detenerBtn.addEventListener('click', () => {
  if (grabadora?.state !== 'inactive') grabadora.stop();
});

enviarAudioBtn.addEventListener('click', async () => {
  if (!datosAudioBlob) return;
  const destino = conexiones.length > 0 ? conexiones[0].peerId : null;
  if (!destino) { alert('Conéctate primero'); return; }

  const leer = (b) => new Promise(r => { const l = new FileReader(); l.onload = () => r(l.result); l.readAsDataURL(b); });
  const datos = await leer(datosAudioBlob);

  const paquete = { tipo: 'audio', de: miId, para: destino, datos, entregado: false };
  
  let enviado = false;
  for (const conn of conexiones) {
    if (conn.peerId === destino && conn.open) {
      conn.send({ ...paquete, entregado: true });
      enviado = true;
      break;
    }
  }

  await guardarMensaje({ ...paquete, entregado: enviado });
  agregarAudioUI('Tú', datos, true, enviado);
  
  datosAudioBlob = null;
  enviarAudioBtn.disabled = true;
  actualizarPendientesInfo();
});

function agregarAudioUI(de, datos, esPropio, entregado) {
  const div = document.createElement('div');
  div.className = `mensaje ${esPropio ? 'propio' : ''} ${entregado ? '' : 'pendiente'}`;
  div.innerHTML = `<strong>${de}:</strong><br><audio controls src="${datos}">${entregado ? '' : '<br><em>⌛ Pendiente</em>'}`;
  muro.prepend(div);
}

// ==============================================
// PASO 7: LLAMADAS DE AUDIO 📞
// ==============================================
llamarBtn.addEventListener('click', async () => {
  const destino = llamarBtn.dataset.destino;
  if (!destino) return;
  
  flujoLocal = await navigator.mediaDevices.getUserMedia({ audio: true });
  const llamada = peer.call(destino, flujoLocal);
  manejarLlamadaComun(llamada);
});

function manejarLlamadaEntrante(llamada) {
  llamadaActiva = llamada;
  quienLlama.textContent = `Te llama: ${llamada.peer}`;
  llamadaEntrante.classList.remove('oculto');

  responderBtn.onclick = async () => {
    flujoLocal = await navigator.mediaDevices.getUserMedia({ audio: true });
    llamada.answer(flujoLocal);
    manejarLlamadaComun(llamada);
    llamadaEntrante.classList.add('oculto');
  };

  rechazarBtn.onclick = () => {
    llamada.close();
    llamadaEntrante.classList.add('oculto');
  };
}

function manejarLlamadaComun(llamada) {
  llamadaActiva = llamada;
  llamadaEnCurso.classList.remove('oculto');
  estadoLlamada.textContent = 'Conectando...';

  llamada.on('stream', (flujoRemoto) => {
    audioRemoto.srcObject = flujoRemoto;
    estadoLlamada.textContent = '🔊 En llamada...';
  });

  llamada.on('close', () => {
    llamadaEnCurso.classList.add('oculto');
    if (flujoLocal) flujoLocal.getTracks().forEach(t => t.stop());
    llamadaActiva = null;
  });

  colgarBtn.onclick = () => llamada.close();
}
