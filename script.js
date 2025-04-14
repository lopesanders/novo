const imageLoader = document.getElementById('imageLoader');
const canvas = document.getElementById('imageCanvas');
const ctx = canvas.getContext('2d');
const downloadBtn = document.getElementById('downloadBtn');
const shareBtn = document.getElementById('shareBtn');
const loadingMessage = document.getElementById('loadingMessage');
const instructionMessage = document.getElementById('instructionMessage');

// --- CONFIGURAÇÃO ---
const templateImagePath = 'template.png'; // Certifique-se que este arquivo existe!
const outputFilename = 'minha-imagem-personalizada.png';
const ZOOM_SENSITIVITY = 0.002; // Ajuste a sensibilidade do zoom do scroll
const MIN_ZOOM = 0.1; // Zoom mínimo permitido
const MAX_ZOOM = 5.0; // Zoom máximo permitido
// --- FIM DA CONFIGURAÇÃO ---

let userImage = null;
let templateImage = null;
let combinedImageBlob = null;

// Estado da imagem do usuário
let scale = 1;
let offsetX = 0;
let offsetY = 0;

// Estado do arraste (pan)
let isDragging = false;
let startX;
let startY;

// Variáveis para armazenar as dimensões do template
let templateWidth = 0;
let templateHeight = 0;


// Carrega a imagem do template e define as dimensões do canvas
function loadTemplateAndSetupCanvas() {
    return new Promise((resolve, reject) => {
        templateImage = new Image();
        templateImage.onload = () => {
            // Define o tamanho do canvas baseado no template
            templateWidth = templateImage.naturalWidth;
            templateHeight = templateImage.naturalHeight;
            canvas.width = templateWidth;
            canvas.height = templateHeight;
            resolve(templateImage); // Resolve quando o template carregar
        };
        templateImage.onerror = (err) => {
            console.error("Erro ao carregar a imagem do template:", err);
            alert(`Erro ao carregar o template (${templateImagePath}). Verifique se o arquivo existe.`);
            reject(err);
        };
        templateImage.src = templateImagePath;
    });
}

// Redesenha o canvas com base no estado atual (imagem, template, scale, offset)
function redrawCanvas() {
    if (!userImage || !templateImage) return;

    // Limpa o canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Desenha a imagem do usuário (transformada)
    // Salva o estado atual do canvas (para não afetar o template)
    ctx.save();
    // Aplica o deslocamento (pan) e a escala (zoom)
    // A ordem é importante: primeiro translação, depois escala pode ser mais simples
    // Ou use drawImage com 9 argumentos para definir source/destination rects
    // drawImage(image, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight)
    // Para simplificar, desenhamos a imagem inteira escalada na posição offset
    ctx.drawImage(
        userImage,
        offsetX, // Posição X no canvas
        offsetY, // Posição Y no canvas
        userImage.naturalWidth * scale, // Largura desenhada (com zoom)
        userImage.naturalHeight * scale // Altura desenhada (com zoom)
    );
    // Restaura o estado do canvas (remove transformações)
    ctx.restore();


    // 2. Desenha a imagem do template por cima (sempre fixa)
    ctx.drawImage(templateImage, 0, 0, canvas.width, canvas.height);

     // Prepara para compartilhamento (Web Share API) - faz isso a cada redesenho
     // É um pouco ineficiente, poderia otimizar para fazer só antes de compartilhar/baixar
    prepareShare();
}

// Calcula a posição inicial e escala para a imagem do usuário caber no template
function setInitialImageTransform() {
    if (!userImage || !templateImage) return;

    const imgWidth = userImage.naturalWidth;
    const imgHeight = userImage.naturalHeight;
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;

    // Calcula a escala para a imagem caber inteira dentro do canvas (aspect fill)
    scale = Math.max(canvasWidth / imgWidth, canvasHeight / imgHeight);
    // Garante que a escala inicial não seja menor que o mínimo
    scale = Math.max(MIN_ZOOM, scale);


    // Centraliza a imagem
    offsetX = (canvasWidth - imgWidth * scale) / 2;
    offsetY = (canvasHeight - imgHeight * scale) / 2;

    redrawCanvas();
}


// Listener para quando o usuário escolhe um arquivo
imageLoader.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file || !file.type.startsWith('image/')) {
        alert('Por favor, selecione um arquivo de imagem válido.');
        imageLoader.value = ''; // Limpa o input
        return;
    }

    // Mostra mensagem de carregamento e desabilita botões
    loadingMessage.style.display = 'block';
    instructionMessage.style.display = 'none';
    downloadBtn.disabled = true;
    shareBtn.style.display = 'none';
    canvas.style.cursor = 'default'; // Cursor padrão durante carregamento

    try {
        // 1. Garante que o template está carregado e o canvas dimensionado
        await loadTemplateAndSetupCanvas();

        // 2. Carrega a imagem do usuário
        const userImagePromise = new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                userImage = new Image();
                userImage.onload = resolve;
                userImage.onerror = reject;
                userImage.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });

        await userImagePromise;

        // 3. Define a transformação inicial e desenha
        setInitialImageTransform();

        // Habilita controles e mostra instruções
        downloadBtn.disabled = false;
        loadingMessage.style.display = 'none';
        instructionMessage.style.display = 'block';
        canvas.style.cursor = 'grab'; // Define cursor inicial para arrastar

    } catch (error) {
        console.error("Erro no processo de carregamento:", error);
        alert("Ocorreu um erro ao carregar as imagens. Tente novamente.");
        loadingMessage.style.display = 'none';
        instructionMessage.style.display = 'none';
        downloadBtn.disabled = true;
        shareBtn.style.display = 'none';
        imageLoader.value = ''; // Limpa o input
         // Limpa o canvas se algo deu errado
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        userImage = null; // Reseta a imagem do usuário
    }
});

// --- Event Handlers para Pan (Arrastar) ---

function getEventLocation(e) {
    // Pega a posição do mouse ou toque relativa ao canvas
    if (e.touches && e.touches.length == 1) {
        return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.clientX && e.clientY) {
        return { x: e.clientX, y: e.clientY };
    }
    return null; // Nenhum evento válido
}


canvas.addEventListener('mousedown', (e) => {
    if (!userImage) return;
    isDragging = true;
    const location = getEventLocation(e);
    startX = location.x - offsetX; // Armazena posição relativa ao canto da imagem
    startY = location.y - offsetY;
    canvas.style.cursor = 'grabbing'; // Muda o cursor
    e.preventDefault(); // Previne seleção de texto
});

canvas.addEventListener('touchstart', (e) => {
     if (!userImage || e.touches.length !== 1) return; // Só ativa com um dedo
    isDragging = true;
    const location = getEventLocation(e);
    startX = location.x - offsetX;
    startY = location.y - offsetY;
    // Não muda cursor em touch, mas previne scroll da página
     e.preventDefault();
});


canvas.addEventListener('mousemove', (e) => {
    if (!isDragging || !userImage) return;
    const location = getEventLocation(e);
    offsetX = location.x - startX;
    offsetY = location.y - startY;
    redrawCanvas();
    e.preventDefault(); // Previne seleção enquanto arrasta
});

canvas.addEventListener('touchmove', (e) => {
     if (!isDragging || !userImage || e.touches.length !== 1) return;
    const location = getEventLocation(e);
    offsetX = location.x - startX;
    offsetY = location.y - startY;
    redrawCanvas();
     e.preventDefault(); // Previne scroll da página
});


canvas.addEventListener('mouseup', () => {
    if (!userImage) return;
    isDragging = false;
    canvas.style.cursor = 'grab'; // Restaura cursor
});

canvas.addEventListener('touchend', () => {
     if (!userImage) return;
    isDragging = false;
    // Lógica adicional para pinch zoom iria aqui se implementada
});

canvas.addEventListener('mouseleave', () => {
    // Cancela o arraste se o mouse sair do canvas
    if (isDragging) {
         if (!userImage) return;
        isDragging = false;
        canvas.style.cursor = 'grab';
    }
});


// --- Event Handler para Zoom (Scroll do Mouse) ---

canvas.addEventListener('wheel', (e) => {
    if (!userImage) return;
    e.preventDefault(); // Previne o scroll da página

    const rect = canvas.getBoundingClientRect();
    // Posição do mouse relativa ao canvas
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Calcula a posição do ponteiro do mouse sobre a imagem (antes do zoom)
    const imgX = (mouseX - offsetX) / scale;
    const imgY = (mouseY - offsetY) / scale;

    // Calcula a nova escala
    let delta = e.deltaY * ZOOM_SENSITIVITY;
    let newScale = scale - delta; // Subtrai porque deltaY é positivo para scroll "para baixo" (zoom out)

    // Limita a escala
    newScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newScale));

    // Calcula o novo offset para manter o ponto sob o mouse fixo
    offsetX = mouseX - imgX * newScale;
    offsetY = mouseY - imgY * newScale;
    scale = newScale; // Atualiza a escala global

    redrawCanvas();
});


// --- Botão de Download (sem alterações na lógica principal) ---
downloadBtn.addEventListener('click', () => {
    if (!userImage || !templateImage) return;

    // A função redrawCanvas já garante que o canvas está como o usuário vê.
    // Apenas criamos o link e baixamos o conteúdo atual do canvas.
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = outputFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});

// --- Funcionalidade de Compartilhamento (sem alterações na lógica principal) ---

function prepareShare() {
    if (!navigator.share || !canvas || canvas.width === 0) {
         shareBtn.style.display = 'none'; // Esconde se não suportado ou canvas vazio
         combinedImageBlob = null;
        return;
    }

    canvas.toBlob( (blob) => {
        if (blob) {
            combinedImageBlob = blob;
            // Só mostra o botão se o blob foi criado com sucesso
            // (Poderia mover a exibição para o final do carregamento da imagem)
            if(downloadBtn.disabled === false) { // Verifica se imagem está carregada
                 shareBtn.style.display = 'inline-block';
            }
        } else {
            console.error("Falha ao criar Blob da imagem para compartilhamento.");
            shareBtn.style.display = 'none';
             combinedImageBlob = null;
        }
    }, 'image/png');
}

shareBtn.addEventListener('click', async () => {
    if (!combinedImageBlob) {
        alert("A imagem ainda não está pronta para compartilhar ou ocorreu um erro.");
        return;
    }

    const shareData = {
        files: [ new File([combinedImageBlob], outputFilename, { type: combinedImageBlob.type }) ],
        title: 'Minha Imagem Personalizada',
        text: 'Veja a imagem que criei!',
    };

    try {
        await navigator.share(shareData);
        console.log('Imagem compartilhada com sucesso!');
    } catch (err) {
        if (err.name !== 'AbortError') {
            console.error('Erro ao compartilhar:', err);
            alert(`Erro ao compartilhar: ${err.message}`);
        } else {
            console.log('Compartilhamento cancelado.');
        }
    }
});

// Limpa o estado inicial (caso a página seja recarregada)
window.addEventListener('load', () => {
    imageLoader.value = ''; // Garante que o input de arquivo esteja vazio
    loadingMessage.style.display = 'none';
    instructionMessage.style.display = 'none';
    downloadBtn.disabled = true;
    shareBtn.style.display = 'none';
});
