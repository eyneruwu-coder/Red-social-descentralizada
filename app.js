async function conectar(numero) {
  if (!numero) return;

  // Limpiar intentos anteriores
  if (reconectarTiempo) clearTimeout(reconectarTiempo);
  if (peer) peer.destroy();

  miId = numero;
  await guardarValor('miNumero', numero);

  btnConectar.disabled = true;
  btnConectar.textContent = 'Conectando...';
  // ✅ NO bloqueamos al inicio → ya se quitó el readonly de arriba
  estadoConexion.textContent = 'Conectando...';
  estadoConexion.className = 'estado-texto estado-reintentando';

  peer = new Peer(miId);

  peer.on('open', id => {
    miId = id;
    btnConectar.textContent = 'Conectado';
    estadoConexion.textContent = '● En línea';
    estadoConexion.className = 'estado-texto estado-conectado';
    // ✅ SOLO bloqueamos DESPUÉS de conectar bien
    miNumeroInput.readOnly = true;
  });

  peer.on('connection', manejarConexionEntrante);
  peer.on('call', manejarLlamadaEntrante);

  peer.on('error', err => {
    console.error('Error de conexión:', err);
    
    // ✅ Si falla → DESBLOQUEAMOS para que pueda cambiar el número
    miNumeroInput.readOnly = false;
    btnConectar.disabled = false;
    btnConectar.textContent = 'Reintentar';
    
    if (err.type === 'unavailable-id') {
      estadoConexion.textContent = 'Número activo en otro dispositivo';
      estadoConexion.className = 'estado-texto estado-desconectado';
    } else {
      estadoConexion.textContent = 'Desconectado — escribe tu número y pulsa Conectar';
      estadoConexion.className = 'estado-texto estado-desconectado';
    }
  });
}
