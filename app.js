// ELEMENTOS DEL DOM
const miIdentificadorInput = document.getElementById('miIdentificador');
const conectarBtn = document.getElementById('conectarBtn');
const estadoConexion = document.getElementById('estadoConexion');
const avisoAuto = document.getElementById('avisoAuto');
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
const llamadaEnCurso = document.getElementById('llamadaEnCurso');
const llamadaEntrante = document.getElementById('llamadaEntrante');
const quienLlama = document.getElementById('quienLlama');
const estadoLlamada = document.getElementById('estadoLlamada');
const audioRemoto = document.getElementById('audioRemoto');

let peer;
let conexiones = [];
let miId = '';
let miNumeroGuardado = '';
let grabadora;
let datosAudioBlob = null;
let baseDatos;
let llamadaActiva = null;
let flujoLocal = null;
let reconectarTiempo = null;
let verificacionConexion = null;

// ==============================================
// INDEXEDDB — BASE DE DATOS LOCAL
// ==============================================
function iniciarBaseDatos() {
  return new Promise((resolver, rechazar) => {
    const solicitud = indexedDB.open('RedDescentralizada', 3);
    
    solicitud.onupgradeneeded = (e) => {
      baseDatos = e.target.result;
      if (!baseDatos.objectStoreNames.contains('config')) {
        baseDatos.createObjectStore('config');
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

async function guardarConfig(clave, valor) {
  return new Promise(resolver => {
    const tx = baseDatos.transaction('config', 'readwrite');
    tx.objectStore('config').put(valor, clave);
    tx.oncomplete = resolver;
  });
}

async function leerConfig(clave) {
  return new Promise(resolver => {
    const tx = baseDatos.transaction('config');
    const solicitud = tx.objectStore('config').get(clave);
    solicitud.onsuccess = () => resolver(solicitud.result || null);
  });
}

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
// CARGA INICIAL + CONEXIÓN AUTOMÁTICA
// ==============================================
async function iniciarTodo() {
  await iniciarBaseDatos();
  
  // Recuperar número guardado
  miNumeroGuardado = await leerConfig('miNumero');
  const activarAuto = await leerConfig('conexionAutomatica');
  
  if (miNumeroGuardado) {
    miIdentificadorInput.value = miNumeroGuardado;
    
    // Conectar automáticamente si está activado
    if (activarAuto !== false) {
      avisoAuto.classList.remove('oculto');
      await conectarConIdentidad(miNumeroGuardado);
    }
  } else {
    avisoAuto.textContent = 'Escribe tu número para empezar';
  }

  // Cargar historial
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

// ==============================================
// FUNCIÓN CENTRAL DE CONEXIÓN
// ==============================================
async function conectarConIdentidad(numero) {
  if (!numero) return;
  
  // Limpiar intentos anteriores
  if (reconectarTiempo) clearTimeout(reconectarTiempo);
  if (verificacionConexion) clearInterval(verificacionConexion);
  if (peer) peer.destroy();
  
  miId = numero;
  await guardarConfig('miNumero', numero);
  await guardarConfig('conexionAutomatica', true); // Activar auto para próximas veces

  conectarBtn.disabled = true;
  conectarBtn.textContent = 'Conectando...';
  miIdentificadorInput.disabled = true;
  avisoAuto.textContent = '🔄 Estableciendo conexión...';

  // CREAR CONEXIÓN CON NUESTRO NÚMERO
  peer = new Peer(miId);

  peer.on('open', async (idAsignado) => {
    miId = idAsignado;
    conectarBtn.textContent = '✅ En línea';
    estadoConexion.textContent = `Conectado como: ${miId}`;
    estadoConexion.className = 'resaltado conectado';
    avisoAuto.textContent = '✅ Conexión automática activa';
    
    // Enviar pendientes
    await entregarPendientes();
    
    // Iniciar verificación de conexión cada 15s
    verificacionConexion = setInterval(() => {
      verificarConexionesActivas();
    }, 15000);
  });

  peer.on('connection', manejarConexionEntrante);
  peer.on('call', manejarLlamadaEntrante);

  peer.on('error', (err) => {
    console.error('Error de conexión:', err);
    
    if (err.type === 'unavailable-id') {
      estadoConexion.textContent = '⚠️ Número activo en otro dispositivo';
      estadoConexion.className = 'resaltado desconectado';
      avisoAuto.textContent = 'Desconecta del otro dispositivo primero';
      conectarBtn.disabled = false;
      conectarBtn.textContent = 'Reintentar';
      miIdentificadorInput.disabled = false;
    } else if (err.type === 'network' || err.type === 'disconnected') {
      estadoConexion.textContent = '🔌 Sin red — reconectando...';
      estadoConexion.className = 'resaltado desconectado';
      reconectarTiempo = setTimeout(() => conectarConIdentidad(numero), 5000);
    } else {
      estadoConexion.textContent = `Error: ${err.type}`;
      reconectarTiempo = setTimeout(() => conectarConIdentidad(numero), 8000);
    }
  });
}

// Botón manual — ahora también activa auto
conectarBtn.addEventListener('click', async () => {
  const numero = miIdentificadorInput.value.trim();
  if (!numero) {
    alert('Escribe tu número primero');
    return;
  }
  await conectarConIdentidad(numero);
});

// ==============================================
// DETECCIÓN DE DESCONEXIÓN — LA CORRECCIÓN PRINCIPAL
// ==============================================
function verificarConexionesActivas() {
  conexiones = conexiones.filter(conn => {
    if (!conn.open) {
      console.log('Conexión cerrada con:', conn.peerId);
      return false;
    }
    return true;
  });
  actualizarLista();
}

// AVISAR DESPEDIDA AL CERRAR LA PÁGINA
window.addEventListener('beforeunload', () => {
  // Avisar a todos que nos vamos
  conexiones.forEach(conn => {
    if (conn.open) {
      try {
        conn.send({ tipo: 'despedida', de: miId });
        conn.close();
      } catch (e) {}
    }
  });
  if (peer) peer.destroy();
  if (verificacionConexion) clearInterval(verificacionConexion);
});

// ==============================================
// CONECTAR CON OTROS
// ==============================================
enlazarBtn.addEventListener('click', async () => {
  const destino = idDestinoInput.value.trim();
  if (!destino || !peer) return;
  
  const conn = peer.connect(destino, { reliable: true });
  conn.on('open', async () => {
    manejarConexion(conn);
    await entregarPendientesA(conn, destino);
    llamarBtn.disabled = false;
    llamarBtn.dataset.destino = destino;
  });
  conn.on('error', (err) => {
    console.log('Error al conectar con', destino, err);
  });
});

async function manejarConexionEntrante(conn) {
  manejarConexion(conn);
  conn.on('open', async () => {
    await entregarPendientesA(conn, miId);
    llamarBtn.disabled = false;
    llamarBtn.dataset.destino = conn.peer;
  });
}

function manejarConexion(conn) {
  // Evitar duplicados
  if (conexiones.some(c => c.peerId === conn.peer)) return;
  
  conn.peerId = conn.peer;
  conexiones.push(conn);
  actualizarLista();

  conn.on('data', async (recibido) => {
    // Se despide → lo quitamos ya
    if (recibido.tipo === 'despedida') {
      conexiones = conexiones.filter(c => c.peerId !== conn.peerId);
      actualizarLista();
      return;
    }

    if (recibido.tipo === 'texto' || recibido.tipo === 'audio') {
      await guardarMensaje({ ...recibido, entregado: true });
      
      if (recibido.tipo === 'texto') {
        agregarMensajeUI(recibido.de, recibido.texto, false, true);
      } else {
        agregarAudioUI(recibido.de, recibido.datos, false, true);
      }
    }
    
    if (recibido.tipo === 'solicitud-pendientes') {
      const pendientes = await leerPendientesPara(recibido.de);
      for (const m of pendientes) {
        conn.send({
          tipo: m.tipo,
          de: miId,
          para: recibido.de,
          texto: m.texto || null,
          datos: m.datos || null,
          entregado: true
        });
        // Marcar como entregado por ID si existe
        if (m.id) await marcarEntregado(m.id);
      }
    }
  });

  conn.on('close', () => {
    conexiones = conexiones.filter(c => c.peerId !== conn.peerId);
    actualizarLista();
    llamarBtn.disabled = conexiones.length === 0;
  });

  conn.on('error', () => {
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
    li.innerHTML = `
      <span>🔗 ${c.peerId}</span>
      <span class="estado-usuario">● En línea</span>
    `;
    listaConectados.appendChild(li);
  });

  if (conexiones.length === 0) {
    llamarBtn.disabled = true;
  }
}

// ==============================================
// MENSAJES PENDIENTES Y ENTREGA
// ==============================================
async function entregarPendientesA(conn, destino) {
  conn.send({ tipo: 'solicitud-pendientes', de: miId, para: destino });
}

async function entregarPendientes() {
  for (const conn of conexiones) {
    await entregarPendientesA(conn, conn.peerId);
  }
}

// Enviar texto
publicarBtn.addEventListener('click', async () => {
  const texto = mensajeInput.value.trim();
  if (!texto || !peer) return;

  if (conexiones.length === 0) {
    alert('Conéctate con alguien primero escribiendo su número');
    return;
  }

  const destino = conexiones[0].peerId;
  const paquete = {
    tipo: 'texto',
    de: miId,
    para: destino,
    texto: texto,
    entregado: false
  };

  let enviado = false;
  for (const conn of conexiones) {
    if (conn.peerId === destino && conn.open) {
      conn.send({ ...paquete, entregado: true });
      enviado = true;
      break;
    }
  }

  await guardarMensaje({ ...paquete, entregado: enviado });
  agregarMensajeUI('Tú', texto, true, enviado);
  
  mensajeInput.value = '';
  actualizarPendientesInfo();
});

function agregarMensajeUI(de, texto, esPropio, entregado) {
  const div = document.createElement('div');
  div.className = `mensaje ${esPropio ? 'propio' : ''} ${entregado ? 'entregado' : 'pendiente'}`;
  div.innerHTML = `<strong>${de}:</strong><br>${texto}${entregado ? '' : '<br><em>⌛ Pendiente — se entregará cuando se conecte</em>'}`;
  muro.prepend(div);
}

function actualizarPendientesInfo() {
  leerMensajes().then(todos => {
    const pend = todos.filter(m => m.de === miId && !m.entregado).length;
    pendientesInfo.textContent = pend > 0 ? `📦 ${pend} mensajes pendientes — se entregarán al reconectar` : '';
  });
}

// ==============================================
// AUDIO
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
      if (flujoLocal) flujoLocal.getTracks().forEach(t => t.stop());
    };

    grabadora.start();
    grabarBtn.disabled = true;
    detenerBtn.disabled = false;
  } catch {
    alert('Se necesita permiso al micrófono');
  }
});

detenerBtn.addEventListener('click', () => {
  if (grabadora && grabadora.state !== 'inactive') {
    grabadora.stop();
  }
});

enviarAudioBtn.addEventListener('click', async () => {
  if (!datosAudioBlob || conexiones.length === 0) {
    alert('Conéctate primero con alguien');
    return;
  }

  const destino = conexiones[0].peerId;
  const leer = (blob) => new Promise(res => {
    const lector = new FileReader();
    lector.onload = () => res(lector.result);
    lector.readAsDataURL(blob);
  });
  const datos = await leer(datosAudioBlob);

  const paquete = {
    tipo: 'audio',
    de: miId,
    para: destino,
    datos: datos,
    entregado: false
  };

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
  div.innerHTML = `
    <strong>${de}:</strong><br>
    <audio controls src="${datos}">
    ${entregado ? '' : '<br><em>⌛ Pendiente de entrega</em>'}
  `;
  muro.prepend(div);
}

// ==============================================
// LLAMADAS
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

  llamada.on('error', () => {
    llamadaEnCurso.classList.add('oculto');
    if (flujoLocal) flujoLocal.getTracks().forEach(t => t.stop());
    llamadaActiva = null;
  });

  colgarBtn.onclick = () => llamada.close();
}

// INICIAR TODO
iniciarTodo();
