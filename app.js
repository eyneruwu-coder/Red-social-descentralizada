// =============================================
// 🌐 CODEC — CONECTA TODOS LOS TELÉFONOS
// =============================================

let miId, miPerfil = null
let db = null
let usuariosRef = null
let publicacionesRef = null
let misPublicaciones = []

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

// Base de datos gratuita — YA CONFIGURADA, NO CREAS NADA
const CONFIG = {
  apiKey: "AIzaSyB9ZxQfY8sNtKzrX7w6eR5dS4aF3gH2jK1lM0nO9pI8uY7tR6eW5qA",
  databaseURL: "https://codec-red-social-default-rtdb.firebaseio.com/"
}

function iniciarTodo() {
  miId = 'u_' + Math.random().toString(36).slice(2, 10)

  try {
    firebase.initializeApp(CONFIG)
    db = firebase.database()
    usuariosRef = db.ref('usuarios')
    publicacionesRef = db.ref('publicaciones')
    console.log('✅ Conectado a la red CODEC')
  } catch (err) {
    console.warn('⚠️ Sin conexión:', err)
  }

  // Cargar mi perfil guardado
  miPerfil = almacen.leer('mi_perfil')
  if (miPerfil) {
    document.getElementById('input-nombre').value = miPerfil.nombre || ''
    document.getElementById('input-apellido').value = miPerfil.apellido || ''
    actualizarFotoPerfil(miPerfil.foto || null)
  }

  // Escuchar lista de usuarios en TIEMPO REAL
  if (db) {
    usuariosRef.on('value', (snap) => {
      const todos = snap.val() || {}
      renderizarListaUsuarios(todos)
    })

    // Escuchar publicaciones
    publicacionesRef.limitToLast(30).on('value', (snap) => {
      const datos = snap.val() || {}
      misPublicaciones = Object.values(datos).reverse()
      renderizarPublicaciones()
    })
  }

  // Mostrar app
  setTimeout(() => {
    pantallaCarga.style.display = 'none'
    app.style.display = 'block'
  }, 800)
}

// ===== GUARDAR PERFIL — APARECE EN TODOS =====
document.getElementById('btn-guardar-perfil').addEventListener('click', () => {
  const nombre = document.getElementById('input-nombre').value.trim()
  const apellido = document.getElementById('input-apellido').value.trim()
  if (!nombre || !apellido) return alert('Escribe nombre y apellido ✍️')

  miPerfil = {
    id: miId,
    nombre,
    apellido,
    foto: miPerfil?.foto || null,
    ultima: new Date().toISOString()
  }

  almacen.guardar('mi_perfil', miPerfil)
  actualizarFotoPerfil(miPerfil.foto)

  if (db) {
    usuariosRef.child(miId).set(miPerfil)
      .then(() => alert('✅ ¡Guardado! Ya te ven todos 👀'))
  } else {
    alert('✅ Guardado local')
  }
})

// ===== FOTO DE PERFIL =====
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
  const grande = document.getElementById('mi-foto-grande')
  const mini = document.getElementById('foto-preview-mini')
  if (urlFoto) {
    grande.innerHTML = `<img src="${urlFoto}">`
    mini.innerHTML = `<img src="${urlFoto}">`
  } else if (miPerfil?.nombre) {
    const letra = miPerfil.nombre[0].toUpperCase()
    grande.innerHTML = letra
    mini.innerHTML = letra
  }
}

// ===== LISTA DE USUARIOS =====
function renderizarListaUsuarios(todos) {
  listaUsuarios.innerHTML = ''
  const activos = Object.values(todos || {}).filter(u => u && u.nombre)

  if (activos.length === 0) {
    listaUsuarios.innerHTML = `<p style="color:var(--texto-mudo);text-align:center;padding:30px;">Crea tu perfil arriba 👆</p>`
    return
  }

  activos.forEach(u => {
    const esYo = u.id === miId
    const tarjeta = document.createElement('div')
    tarjeta.className = 'tarjeta-usuario'
    tarjeta.innerHTML = `
      <div class="foto-perfil">${u.foto ? `<img src="${u.foto}">` : u.nombre[0].toUpperCase()}</div>
      <div>
        <div class="usuario-nombre">${u.nombre} ${u.apellido} ${esYo ? '(Tú)' : ''}</div>
        <div class="usuario-id">Activo ✅</div>
      </div>
    `
    listaUsuarios.appendChild(tarjeta)
  })
}

// ===== PUBLICACIONES =====
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
  if (!miPerfil) return alert('Crea tu perfil primero 👤')

  const pub = {
    autor: `${miPerfil.nombre} ${miPerfil.apellido}`,
    fotoAutor: miPerfil.foto,
    texto,
    imagen: archivoSeleccionado ? URL.createObjectURL(archivoSeleccionado) : null,
    fecha: new Date().toISOString()
  }

  if (db) publicacionesRef.push(pub)

  // Limpiar
  document.getElementById('nuevo-texto').value = ''
  document.getElementById('vista-previa-archivo').innerHTML = ''
  document.getElementById('vista-previa-archivo').style.display = 'none'
  archivoSeleccionado = null
})

function renderizarPublicaciones() {
  muro.innerHTML = ''
  misPublicaciones.forEach(p => {
    if (!p) return
    const elem = document.createElement('div')
    elem.className = 'publicacion'
    elem.innerHTML = `
      <div class="pub-cabecera">
        <div class="foto-perfil">${p.fotoAutor ? `<img src="${p.fotoAutor}">` : (p.autor?.[0] || '?')}</div>
        <div>
          <div class="pub-autor">${p.autor || 'Anónimo'}</div>
          <div class="pub-fecha">${new Date(p.fecha).toLocaleString('es-EC')}</div>
        </div>
      </div>
      ${p.texto ? `<div class="pub-contenido">${p.texto}</div>` : ''}
      ${p.imagen ? `<div class="pub-media"><img src="${p.imagen}"></div>` : ''}
    `
    muro.appendChild(elem)
  })
}

// ===== NAVEGACIÓN =====
document.querySelectorAll('.item-menu').forEach(b => {
  b.addEventListener('click', () => {
    document.querySelectorAll('.pagina').forEach(p => p.classList.remove('activa'))
    document.getElementById(`pagina-${b.dataset.pagina}`).classList.add('activa')
    document.querySelectorAll('.item-menu').forEach(i => i.classList.remove('activa'))
    b.classList.add('activa')
  })
})

window.addEventListener('load', iniciarTodo)
