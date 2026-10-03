// =============================================
// 🌐 CODEC — Red Social Descentralizada
// =============================================

let miId, miPerfil = null
const conversaciones = {}

const almacen = {
  guardar(clave, valor) {
    localStorage.setItem(`codec_${clave}`, JSON.stringify(valor))
  },
  leer(clave, porDefecto = null) {
    const d = localStorage.getItem(`codec_${clave}`)
    return d ? JSON.parse(d) : porDefecto
  }
}

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

function iniciarTodo() {
  miId = 'user-' + Math.random().toString(36).slice(2, 10)
  miPerfil = almacen.leer('mi_perfil')

  if (miPerfil) {
    document.getElementById('input-nombre').value = miPerfil.nombre || ''
    document.getElementById('input-apellido').value = miPerfil.apellido || ''
    actualizarFotoPerfil(miPerfil.foto || null)
  }

  setTimeout(() => {
    pantallaCarga.style.display = 'none'
    app.style.display = 'block'
    cargarDatosDemo()
  }, 800)
}

function cargarDatosDemo() {
  muro.innerHTML = `
    <div class="publicacion">
      <div class="pub-cabecera">
        <div class="foto-perfil">C</div>
        <div>
          <div class="pub-autor">CODEC</div>
          <div class="pub-fecha">Red activa</div>
        </div>
      </div>
      <div class="pub-contenido">¡Bienvenido a la red descentralizada! 🚀<br>Crea tu perfil y empieza a compartir.</div>
    </div>
  `
  listaUsuarios.innerHTML = `
    <p style="color: var(--texto-mudo); text-align:center; padding:30px;">
      Crea tu perfil arriba 👆<br>y comparte el enlace con amigos
    </p>
  `
}

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
  }
  vista.style.display = 'block'
})

document.getElementById('btn-publicar').addEventListener('click', () => {
  const texto = document.getElementById('nuevo-texto').value.trim()
  if (!texto && !archivoSeleccionado) return alert('Escribe algo 📝')
  if (!miPerfil) return alert('Crea tu perfil en "Comunidad" primero 👤')

  const fecha = new Date().toLocaleString('es-EC')
  const nuevo = document.createElement('div')
  nuevo.className = 'publicacion'
  nuevo.innerHTML = `
    <div class="pub-cabecera">
      <div class="foto-perfil">${miPerfil.foto ? `<img src="${miPerfil.foto}">` : miPerfil.nombre[0]}</div>
      <div>
        <div class="pub-autor">${miPerfil.nombre} ${miPerfil.apellido}</div>
        <div class="pub-fecha">${fecha}</div>
      </div>
    </div>
    ${texto ? `<div class="pub-contenido">${texto}</div>` : ''}
    ${archivoSeleccionado ? `<div class="pub-media"><img src="${URL.createObjectURL(archivoSeleccionado)}"></div>` : ''}
  `
  muro.insertBefore(nuevo, muro.firstChild)

  document.getElementById('nuevo-texto').value = ''
  document.getElementById('vista-previa-archivo').innerHTML = ''
  document.getElementById('vista-previa-archivo').style.display = 'none'
  archivoSeleccionado = null
})

document.getElementById('foto-perfil-entrada').addEventListener('change', e => {
  const arch = e.target.files[0]
  if (!arch) return
  const lector = new FileReader()
  lector.onload = ev => {
    if (!miPerfil) miPerfil = {}
    miPerfil.foto = ev.target.result
    actualizarFotoPerfil(miPerfil.foto)
  }
  lector.readAsDataURL(arch)
})

function actualizarFotoPerfil(urlFoto) {
  const elem = document.getElementById('mi-foto-grande')
  const elemMini = document.getElementById('foto-preview-mini')
  if (urlFoto) {
    elem.innerHTML = `<img src="${urlFoto}" alt="Yo">`
    elemMini.innerHTML = `<img src="${urlFoto}" alt="Yo">`
  } else if (miPerfil?.nombre) {
    const inicial = miPerfil.nombre[0].toUpperCase()
    elem.innerHTML = inicial
    elemMini.innerHTML = inicial
  }
}

document.getElementById('btn-guardar-perfil').addEventListener('click', () => {
  const nombre = document.getElementById('input-nombre').value.trim()
  const apellido = document.getElementById('input-apellido').value.trim()
  if (!nombre || !apellido) return alert('Escribe tu nombre y apellido ✍️')

  miPerfil = {
    nombre,
    apellido,
    foto: miPerfil?.foto || null
  }
  almacen.guardar('mi_perfil', miPerfil)
  actualizarFotoPerfil(miPerfil.foto)
  alert('✅ Perfil guardado!')
})

let conversacionActiva = null

document.getElementById('volver-chats').addEventListener('click', () => {
  conversacionActiva = null
  ventanaChat.style.display = 'none'
  listaChats.style.display = 'flex'
  tituloChat.textContent = 'Mensajes'
})

document.getElementById('btn-enviar').addEventListener('click', enviarMensaje)
inputMensaje.addEventListener('keydown', e => e.key === 'Enter' && enviarMensaje())

function enviarMensaje() {
  const texto = inputMensaje.value.trim()
  if (!texto) return
  const div = document.createElement('div')
  div.className = 'mensaje mio'
  div.textContent = texto
  mensajesChat.appendChild(div)
  inputMensaje.value = ''
  mensajesChat.scrollTop = mensajesChat.scrollHeight
}

document.querySelectorAll('.item-menu').forEach(boton => {
  boton.addEventListener('click', () => {
    document.querySelectorAll('.pagina').forEach(p => p.classList.remove('activa'))
    document.getElementById(`pagina-${boton.dataset.pagina}`).classList.add('activa')
    document.querySelectorAll('.item-menu').forEach(b => b.classList.remove('activa'))
    boton.classList.add('activa')
    conversacionActiva = null
    ventanaChat.style.display = 'none'
    listaChats.style.display = 'flex'
  })
})

window.addEventListener('load', iniciarTodo)
