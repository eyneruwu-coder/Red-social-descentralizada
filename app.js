// =============================================
// 🌐 CODEC — Red Social Descentralizada
// IPFS + OrbitDB | Sin servidores | Sin costos
// =============================================

// ===== ESTADO GLOBAL =====
let ipfs, orbitdb, nodo, miId, miPerfil = null
let basePublicaciones, baseUsuarios, baseChats
let conversacionActiva = null
const imagenesTemp = {} // Para previsualizar antes de publicar

// ===== ALMACENAMIENTO LOCAL =====
const almacen = {
  guardar(clave, valor) {
    localStorage.setItem(`codec_${clave}`, JSON.stringify(valor))
  },
  leer(clave, porDefecto = null) {
    const d = localStorage.getItem(`codec_${clave}`)
    return d ? JSON.parse(d) : porDefecto
  },
  limpiar(clave) {
    localStorage.removeItem(`codec_${clave}`)
  }
}

// ===== ELEMENTOS DEL DOM =====
const pantallaCarga = document.getElementById('pantalla-carga')
const app = document.getElementById('app')
const muro = document.getElementById('muro')
const listaUsuarios = document.getElementById('lista-usuarios')
const listaChats = document.getElementById('lista-chats')
const ventanaChat = document.getElementById('ventana-chat')
const mensajesChat = document.getElementById('mensajes-chat')
const tituloChat = document.getElementById('titulo-chat')
const inputMensaje = document.getElementById('input-mensaje')
const contadorMensajes = document.getElementById('contador-mensajes')

// ===== INICIO DE LA RED =====
async function iniciarTodo() {
  try {
    // 1. Conectar a IPFS
    ipfs = window.IpfsHttpClient.create({ host: 'ipfs.io', port: 443, protocol: 'https' })
    const id = await ipfs.id()
    miId = id.id
    console.log('✅ Conectado como:', miId.slice(0, 12))

    // 2. Iniciar OrbitDB
    orbitdb = await OrbitDB.createInstance({ ipfs })
    console.log('✅ OrbitDB lista')

    // 3. Abrir las bases de datos compartidas
    basePublicaciones = await orbitdb.docs('codec-publicaciones', {
      accessController: { write: ['*'] } // Todos pueden escribir
    })
    baseUsuarios = await orbitdb.keyvalue('codec-usuarios', {
      accessController: { write: ['*'] }
    })
    baseChats = await orbitdb.docs('codec-chats-privados', {
      accessController: { write: ['*'] }
    })

    // Escuchar cambios en tiempo real
    basePublicaciones.events.on('update', renderizarPublicaciones)
    baseUsuarios.events.on('update', renderizarUsuarios)
    baseChats.events.on('update', () => {
      renderizarChats()
      actualizarContador()
    })

    await basePublicaciones.load()
    await baseUsuarios.load()
    await baseChats.load()

    // Cargar mi perfil guardado
    miPerfil = almacen.leer('mi_perfil')
    if (miPerfil) {
      document.getElementById('input-nombre').value = miPerfil.nombre || ''
      document.getElementById('input-apellido').value = miPerfil.apellido || ''
      actualizarFotoPerfil(miPerfil.foto || null)
    }

    // Ocultar carga, mostrar app
    setTimeout(() => {
      pantallaCarga.style.display = 'none'
      app.style.display = 'block'
      renderizarPublicaciones()
      renderizarUsuarios()
      renderizarChats()
    }, 1000)

  } catch (err) {
    console.error('❌ Error de conexión:', err)
    // Reintentar tras 3 segundos
    setTimeout(iniciarTodo, 3000)
  }
}

// ===== PUBLICAR EN EL MURO =====
let archivoSeleccionado = null

document.getElementById('archivo-entrada').addEventListener('change', e => {
  const arch = e.target.files[0]
  if (!arch) return
  archivoSeleccionado = arch
  const vista = document.getElementById('vista-previa-archivo')
  vista.innerHTML = ''
  if (arch.type.startsWith('image/')) {
    const img = document.createElement('img')
    img.src = URL.createObjectURL(arch)
    vista.appendChild(img)
  } else if (arch.type.startsWith('video/')) {
    const vid = document.createElement('video')
    vid.src = URL.createObjectURL(arch)
    vid.controls = true
    vista.appendChild(vid)
  }
  vista.style.display = 'block'
})

document.getElementById('btn-publicar').addEventListener('click', async () => {
  const texto = document.getElementById('nuevo-texto').value.trim()
  if (!texto && !archivoSeleccionado) return alert('Escribe algo o sube un archivo 📝')
  if (!miPerfil) return alert('Crea tu perfil primero en "Usuarios" 👤')

  let mediaCid = null, mediaTipo = null
  if (archivoSeleccionado) {
    try {
      const { cid } = await ipfs.add(archivoSeleccionado)
      mediaCid = cid.toString()
      mediaTipo = archivoSeleccionado.type
    } catch (e) {
      console.warn('No se subió archivo a IPFS:', e)
    }
  }

  const pub = {
    autorId: miId,
    nombre: `${miPerfil.nombre} ${miPerfil.apellido}`,
    fotoAutor: miPerfil.foto || null,
    contenido: texto,
    mediaCid,
    mediaTipo,
    fecha: new Date().toISOString()
  }

  await basePublicaciones.put(pub)

  // Limpiar
  document.getElementById('nuevo-texto').value = ''
  document.getElementById('vista-previa-archivo').innerHTML = ''
  document.getElementById('vista-previa-archivo').style.display = 'none'
  archivoSeleccionado = null
})

function renderizarPublicaciones() {
  const todas = basePublicaciones.collect()
    .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))

  muro.innerHTML = todas.map(p => {
    const tieneMedia = p.mediaCid
    const urlMedia = tieneMedia ? `https://ipfs.io/ipfs/${p.mediaCid}` : null
    const inicial = (p.nombre || 'A')[0].toUpperCase()
    const fotoHtml = p.fotoAutor
      ? `<img src="${p.fotoAutor}" alt="Foto">`
      : inicial

    return `
      <div class="publicacion">
        <div class="pub-cabecera">
          <div class="foto-perfil">${fotoHtml}</div>
          <div>
            <div class="pub-autor">${p.nombre || 'Anónimo'}</div>
            <div class="pub-fecha">${new Date(p.fecha).toLocaleString('es-EC')}</div>
          </div>
        </div>
        ${p.contenido ? `<div class="pub-contenido">${p.contenido}</div>` : ''}
        ${tieneMedia ? `
          <div class="pub-media">
            ${p.mediaTipo?.startsWith('image/')
              ? `<img src="${urlMedia}" alt="Imagen">`
              : `<video src="${urlMedia}" controls></video>`
            }
          </div>
        ` : ''}
      </div>
    `
  }).join('')
}

// ===== PERFIL DE USUARIO =====
document.getElementById('foto-perfil-entrada').addEventListener('change', e => {
  const arch = e.target.files[0]
  if (!arch) return
  const lector = new FileReader()
  lector.onload = ev => {
    imagenesTemp['mi-foto'] = ev.target.result
    actualizarFotoPerfil(ev.target.result)
  }
  lector.readAsDataURL(arch)
})

function actualizarFotoPerfil(urlFoto) {
  const elem = document.getElementById('mi-foto-grande')
  const elemMini = document.getElementById('foto-preview-mini')
  if (urlFoto) {
    elem.innerHTML = `<img src="${urlFoto}" alt="Yo">`
    elemMini.innerHTML = `<img src="${urlFoto}" alt="Yo">`
  } else {
    const inicial = (miPerfil?.nombre || 'U')[0].toUpperCase()
    elem.innerHTML = inicial
    elemMini.innerHTML = inicial
  }
}

document.getElementById('btn-guardar-perfil').addEventListener('click', async () => {
  const nombre = document.getElementById('input-nombre').value.trim()
  const apellido = document.getElementById('input-apellido').value.trim()
  if (!nombre || !apellido) return alert('Escribe tu nombre y apellido ✍️')

  miPerfil = {
    id: miId,
    nombre,
    apellido,
    foto: imagenesTemp['mi-foto'] || miPerfil?.foto || null,
    ultimaConexion: new Date().toISOString()
  }

  almacen.guardar('mi_perfil', miPerfil)

  // Compartir perfil a la red
  await baseUsuarios.set(miId, miPerfil)

  actualizarFotoPerfil(miPerfil.foto)
  alert('✅ Perfil guardado! Ya apareces en la lista de usuarios')
})

function renderizarUsuarios() {
  const todos = baseUsuarios.all || {}
  const entradas = Object.values(todos).filter(u => u.id !== miId)

  listaUsuarios.innerHTML = entradas.length
    ? entradas.map(u => `
        <div class="tarjeta-usuario" data-id="${u.id}">
          <div class="foto-perfil-chat">
            ${u.foto ? `<img src="${u.foto}" alt="${u.nombre}">` : (u.nombre[0] || '?').toUpperCase()}
          </div>
          <div>
            <div class="usuario-nombre">${u.nombre} ${u.apellido}</div>
            <div class="usuario-id">Activo</div>
          </div>
        </div>
      `).join('')
    : '<p style="color: var(--texto-mudo); text-align:center; padding:20px;">No hay otros usuarios conectados aún. Comparte el enlace con amigos 🔗</p>'

  // Acción: abrir chat al hacer clic
  listaUsuarios.querySelectorAll('.tarjeta-usuario').forEach(tarjeta => {
    tarjeta.addEventListener('click', () => {
      const idOtro = tarjeta.dataset.id
      abrirChatCon(idOtro)
      // Cambiar a pestaña de chat
      document.querySelectorAll('.pagina').forEach(p => p.classList.remove('activa'))
      document.getElementById('pagina-chat').classList.add('activa')
      document.querySelectorAll('.item-menu').forEach(b => b.classList.remove('activa'))
      document.querySelector('[data-pagina="chat"]').classList.add('activa')
    })
  })
}

// ===== CHAT PRIVADO =====
function obtenerIdConversacion(id1, id2) {
  return [id1, id2].sort().join('-')
}

function abrirChatCon(idOtro) {
  conversacionActiva = idOtro
  const perfilOtro = Object.values(baseUsuarios.all || {}).find(u => u.id === idOtro)
  tituloChat.textContent = perfilOtro ? `${perfilOtro.nombre} ${perfilOtro.apellido}` : 'Chat'
  listaChats.style.display = 'none'
  ventanaChat.style.display = 'flex'
  renderizarMensajes()
}

document.getElementById('volver-chats').addEventListener('click', () => {
  conversacionActiva = null
  ventanaChat.style.display = 'none'
  listaChats.style.display = 'flex'
  tituloChat.textContent = 'Mensajes'
})

document.getElementById('btn-enviar').addEventListener('click', enviarMensaje)
inputMensaje.addEventListener('keydown', e => e.key === 'Enter' && enviarMensaje())

async function enviarMensaje() {
  const texto = inputMensaje.value.trim()
  if (!texto || !conversacionActiva) return

  const mensaje = {
    convId: obtenerIdConversacion(miId, conversacionActiva),
    de: miId,
    para: conversacionActiva,
    texto,
    fecha: new Date().toISOString(),
    leido: false
  }

  await baseChats.put(mensaje)
  inputMensaje.value = ''
  renderizarMensajes()
}

function renderizarMensajes() {
  if (!conversacionActiva) return
  const convId = obtenerIdConversacion(miId, conversacionActiva)
  const mensajes = baseChats.collect()
    .filter(m => m.convId === convId)
    .sort((a, b) => new Date(a.fecha) - new Date(b.fecha))

  mensajesChat.innerHTML = mensajes.map(m => {
    const esMio = m.de === miId
    return `
      <div class="mensaje ${esMio ? 'mio' : 'suyo'}">
        ${m.texto}
      </div>
    `
  }).join('')
  mensajesChat.scrollTop = mensajesChat.scrollHeight
}

function renderizarChats() {
  const conversaciones = {}
  const misMensajes = baseChats.collect().filter(m => m.de === miId || m.para === miId)

  misMensajes.forEach(m => {
    const otro = m.de === miId ? m.para : m.de
    if (!conversaciones[otro]) {
      const perfil = Object.values(baseUsuarios.all || {}).find(u => u.id === otro)
      conversaciones[otro] = {
        id: otro,
        nombre: perfil ? `${perfil.nombre} ${perfil.apellido}` : 'Usuario',
        foto: perfil?.foto || null,
        ultimo: m,
        noLeidos: 0
      }
    }
    if (m.para === miId && !m.leido) conversaciones[otro].noLeidos++
  })

  const lista = Object.values(conversaciones).sort((a, b) =>
    new Date(b.ultimo.fecha) - new Date(a.ultimo.fecha)
  )

  if (!conversacionActiva) {
    listaChats.innerHTML = lista.length
      ? lista.map(c => `
          <div class="conversacion" data-id="${c.id}">
            <div class="foto-perfil-chat">
              ${c.foto ? `<img src="${c.foto}" alt="">` : c.nombre[0]}
            </div>
            <div style="flex:1;">
              <div style="font-weight:600;">${c.nombre}</div>
              <div style="font-size:0.8rem; color:var(--texto-mudo);">${c.ultimo.texto.slice(0, 25)}${c.ultimo.texto.length>25?'...':''}</div>
            </div>
            ${c.noLeidos ? `<span style="background:var(--resaltado); color:white; border-radius:10px; padding:2px 6px; font-size:0.7rem;">${c.noLeidos}</span>` : ''}
          </div>
        `).join('')
      : '<p style="color:var(--texto-mudo); text-align:center; padding:30px;">Aún no tienes conversaciones.<br>Ve a "Usuarios" y escribe a alguien 💬</p>'

    listaChats.querySelectorAll('.conversacion').forEach(card => {
      card.addEventListener('click', () => abrirChatCon(card.dataset.id))
    })
  }

  actualizarContador()
}

function actualizarContador() {
  const total = baseChats.collect().filter(m => m.para === miId && !m.leido).length
  contadorMensajes.textContent = total || 0
  contadorMensajes.style.display = total ? 'block' : 'none'
}

// ===== NAVEGACIÓN DEL MENÚ =====
document.querySelectorAll('.item-menu').forEach(boton => {
  boton.addEventListener('click', () => {
    document.querySelectorAll('.pagina').forEach(p => p.classList.remove('activa'))
    document.getElementById(`pagina-${boton.dataset.pagina}`).classList.add('activa')
    document.querySelectorAll('.item-menu').forEach(b => b.classList.remove('activa'))
    boton.classList.add('activa')
    conversacionActiva = null
    ventanaChat.style.display = 'none'
    listaChats.style.display = 'flex'
    tituloChat.textContent = 'Mensajes'
  })
})

// ===== INICIAR TODO =====
window.addEventListener('load', iniciarTodo)
