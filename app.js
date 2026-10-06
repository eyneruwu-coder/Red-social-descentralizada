const miIdentificadorInput = document.getElementById('miIdentificador');
const conectarBtn = document.getElementById('conectarBtn');
const tuIdSpan = document.getElementById('tuId');
const idDestinoInput = document.getElementById('idDestino');
const enlazarBtn = document.getElementById('enlazarBtn');
const listaConectados = document.getElementById('listaConectados');
const contador = document.getElementById('contador');
const mensajeInput = document.getElementById('mensajeInput');
const publicarBtn = document.getElementById('publicarBtn');
const muro = document.getElementById('muro');
const grabarBtn = document.getElementById('grabarBtn');
const detenerBtn = document.getElementById('detenerBtn');
const enviarAudioBtn = document.getElementById('enviarAudioBtn');

let peer;
let conexiones = [];
let miId = '';
let grabadora;
let datosAudioBlob = null;

// --- CONEXIÓN CON TU PROPIO NÚMERO/ID ---
conectarBtn.addEventListener('click', () => {
  miId = miIdentificadorInput.value.trim();
  
  if (!miId) {
    alert('Escribe tu número o identificación primero');
    return;
  }

  // ✅ AQUÍ LE DECIMOS A PEERJS: "usa ESTE nombre como ID"
  peer = new Peer(miId);

  peer.on('open', (idAsignado) => {
    tuIdSpan.textContent = idAsignado;
    conectarBtn.disabled = true;
    conectarBtn.textContent = '✅ Identidad activa';
    miIdentificadorInput.disabled = true;
  });

  peer.on('connection', manejarNuevaConexion);

  peer.on('error', (err) => {
    console.error('Error de conexión:', err);
    if (err.type === 'unavailable-id') {
      alert('⚠️ Ese identificador ya está conectado ahora mismo. Elige otro o espera.');
    } else {
      alert('Error: ' + err.type);
    }
  });
});

// --- CONECTAR CON OTRO ---
enlazarBtn.addEventListener('click', () => {
  const destino = idDestinoInput.value.trim();
  if (!destino || !peer) return;
  
  const conn = peer.connect(destino);
  conn.on('open', () => manejarNuevaConexion(conn));
});

function manejarNuevaConexion(conn) {
  if (conexiones.some(c => c.peerId === conn.peer)) return;
  
  conn.peerId = conn.peer;
  conexiones.push(conn);
  actualizarLista();

  conn.on('data', (recibido) => {
    if (recibido.tipo === 'texto') {
      agregarMensaje(recibido.de, recibido.texto, false);
    }
    if (recibido.tipo === 'audio') {
      agregarAudioRecibido(recibido.de, recibido.datos);
    }
  });

  conn.on('close', () => {
    conexiones = conexiones.filter(c => c.peerId !== conn.peerId);
    actualizarLista();
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

// --- ENVIAR TEXTO ---
publicarBtn.addEventListener('click', () => {
  const texto = mensajeInput.value.trim();
  if (!texto || !peer) return;

  const paquete = { tipo: 'texto', de: miId, texto: texto };
  
  agregarMensaje('Tú', texto, true);
  
  conexiones.forEach(conn => {
    if (conn.open) conn.send(paquete);
  });
  
  mensajeInput.value = '';
});

function agregarMensaje(de, texto, esPropio) {
  const div = document.createElement('div');
  div.className = 'mensaje' + (esPropio ? ' propio' : '');
  div.innerHTML = `<strong>${de}:</strong><br>${texto}`;
  muro.prepend(div);
}

// --- GRABAR Y ENVIAR AUDIO 🎙️ ---
grabarBtn.addEventListener('click', async () => {
  try {
    const flujo = await navigator.mediaDevices.getUserMedia({ audio: true });
    grabadora = new MediaRecorder(flujo);
    datosAudioBlob = null;

    grabadora.ondataavailable = (e) => {
      datosAudioBlob = e.data;
    };

    grabadora.onstop = () => {
      grabarBtn.disabled = false;
      detenerBtn.disabled = true;
      enviarAudioBtn.disabled = !datosAudioBlob;
    };

    grabadora.start();
    grabarBtn.disabled = true;
    detenerBtn.disabled = false;
    
  } catch (err) {
    alert('Necesito permiso para acceder al micrófono');
    console.error(err);
  }
});

detenerBtn.addEventListener('click', () => {
  if (grabadora && grabadora.state !== 'inactive') {
    grabadora.stop();
  }
});

enviarAudioBtn.addEventListener('click', async () => {
  if (!datosAudioBlob || !peer) return;

  // Convertir audio a base64 para enviarlo por la conexión
  const leerComoBase64 = (archivo) => new Promise(resolver => {
    const lector = new FileReader();
    lector.onload = () => resolver(lector.result);
    lector.readAsDataURL(archivo);
  });

  const audioCodificado = await leerComoBase64(datosAudioBlob);

  const paquete = {
    tipo: 'audio',
    de: miId,
    datos: audioCodificado
  };

  // Mostrar en mi pantalla
  agregarAudioMensaje('Tú', audioCodificado, true);

  // Enviar a todos
  conexiones.forEach(conn => {
    if (conn.open) conn.send(paquete);
  });

  datosAudioBlob = null;
  enviarAudioBtn.disabled = true;
});

function agregarAudioRecibido(de, datos) {
  agregarAudioMensaje(de, datos, false);
}

function agregarAudioMensaje(de, datos, esPropio) {
  const div = document.createElement('div');
  div.className = 'mensaje' + (esPropio ? ' propio' : '');
  div.innerHTML = `
    <strong>${de}:</strong><br>
    <audio controls src="${datos}">
  `;
  muro.prepend(div);
}
