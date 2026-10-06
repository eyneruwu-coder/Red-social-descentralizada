const miNombreInput = document.getElementById('miNombre');
const conectarBtn = document.getElementById('conectarBtn');
const miIdSpan = document.getElementById('miId');
const idDestinoInput = document.getElementById('idDestino');
const enlazarBtn = document.getElementById('enlazarBtn');
const listaConectados = document.getElementById('listaConectados');
const contador = document.getElementById('contador');
const mensajeInput = document.getElementById('mensajeInput');
const publicarBtn = document.getElementById('publicarBtn');
const muro = document.getElementById('muro');

let peer;
let conexiones = [];
let miNombre = '';

conectarBtn.addEventListener('click', () => {
  miNombre = miNombreInput.value.trim() || 'Anonimo_' + Math.random().toString(36).substr(2, 4);
  
  peer = new Peer();

  peer.on('open', (id) => {
    miIdSpan.textContent = id;
    conectarBtn.disabled = true;
    conectarBtn.textContent = 'Conectado ✅';
  });

  peer.on('connection', manejarConexion);

  peer.on('error', (err) => {
    console.error('Error:', err);
    alert('Error: ' + err.type);
  });
});

enlazarBtn.addEventListener('click', () => {
  const idDestino = idDestinoInput.value.trim();
  if (!idDestino || !peer) return;
  const conn = peer.connect(idDestino);
  conn.on('open', () => manejarConexion(conn));
});

function manejarConexion(conn) {
  if (conexiones.some(c => c.peerId === conn.peer)) return;
  
  conn.peerId = conn.peer;
  conexiones.push(conn);
  actualizarLista();

  conn.on('data', (datos) => {
    if (datos.tipo === 'publicacion') {
      agregarAlMuro(datos.autor, datos.texto);
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

publicarBtn.addEventListener('click', () => {
  const texto = mensajeInput.value.trim();
  if (!texto || !peer) return;
  
  const datos = {
    tipo: 'publicacion',
    autor: miNombre,
    texto: texto
  };

  agregarAlMuro('Tú', texto);
  
  conexiones.forEach(conn => {
    if (conn.open) conn.send(datos);
  });

  mensajeInput.value = '';
});

function agregarAlMuro(autor, texto) {
  const div = document.createElement('div');
  div.className = 'mensaje';
  div.innerHTML = `<strong>${autor}:</strong><br>${texto}`;
  muro.prepend(div);
}
