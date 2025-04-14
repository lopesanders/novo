const imageLoader = document.getElementById('imageLoader');
const canvas = document.getElementById('imageCanvas');
const ctx = canvas.getContext('2d');
const downloadBtn = document.getElementById('downloadBtn');
const shareBtn = document.getElementById('shareBtn');
const loadingMessage = document.getElementById('loadingMessage');

// --- CONFIGURAÇÃO ---
const templateImagePath = 'template.png'; // Certifique-se que este arquivo existe na mesma pasta!
const outputFilename = 'minha-imagem-personalizada.png'; // Nome do arquivo para download
// --- FIM DA CONFIGURAÇÃO ---

let userImage = null;
let templateImage = null;
let combinedImageBlob = null; // Para armazenar o Blob para compartilhamento

// Carrega a imagem do template uma vez
function loadTemplateImage() {
    return new Promise((resolve, reject) => {
        templateImage = new Image();
        // Prevenir problemas de CORS se a imagem estiver em outro domínio (não deve acontecer aqui)
        // templateImage.crossOrigin = "Anonymous";
        templateImage.onload = () => resolve(templateImage);
        templateImage.onerror = (err) => {
            console.error("Erro ao carregar a imagem do template:", err);
            alert(`Erro ao carregar o template (${templateImagePath}). Verifique se o arquivo existe.`);
            reject(err);
        };
        templateImage.src = templateImagePath;
    });
}

// Função para desenhar as imagens no canvas
function drawImages() {
    if (!userImage || !templateImage) return;

    // Define o tamanho do canvas igual ao da imagem do usuário
    // Isso preserva a resolução original da foto enviada
    canvas.width = userImage.naturalWidth;
    canvas.height = userImage.naturalHeight;

    // Limpa o canvas (caso uma imagem anterior tenha sido carregada)
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Desenha a imagem do usuário (fundo)
    ctx.drawImage(userImage, 0, 0, canvas.width, canvas.height);

    // 2. Desenha a imagem do template por cima
    // O template será esticado/comprimido para caber exatamente sobre a imagem do usuário.
    // Se precisar de outro comportamento (ex: manter proporção, centralizar),
    // cálculos adicionais seriam necessários aqui.
    ctx.drawImage(templateImage, 0, 0, canvas.width, canvas.height);

    // Habilita o botão de download e exibe o canvas
    downloadBtn.disabled = false;
    canvas.style.display = 'block'; // Garante que o canvas seja exibido
    loadingMessage.style.display = 'none'; // Esconde a mensagem de carregamento

    // Prepara para compartilhamento (Web Share API)
    prepareShare();
}

// Listener para quando o usuário escolhe um arquivo
imageLoader.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) {
        return; // Nenhum arquivo selecionado
    }

    // Validação simples de tipo (opcional, mas bom ter)
    if (!file.type.startsWith('image/')) {
        alert('Por favor, selecione um arquivo de imagem (JPG, PNG, GIF, etc.).');
        imageLoader.value = ''; // Limpa o input
        return;
    }


    const reader = new FileReader();

    // Mostra mensagem de carregamento e desabilita botões
    loadingMessage.style.display = 'block';
    downloadBtn.disabled = true;
    shareBtn.style.display = 'none'; // Esconde o botão de compartilhar durante o processo
    canvas.style.display = 'none'; // Esconde o canvas antigo/vazio


    reader.onload = (e) => {
        userImage = new Image();
        userImage.onload = () => {
            // Certifica-se que o template está carregado antes de desenhar
            loadTemplateImage()
                .then(drawImages)
                .catch(() => {
                     // Erro no carregamento do template já foi tratado em loadTemplateImage
                     loadingMessage.style.display = 'none'; // Esconde msg de loading
                     imageLoader.value = ''; // Limpa o input
                });
        };
        userImage.onerror = () => {
            console.error("Erro ao carregar a imagem do usuário.");
            alert("Ocorreu um erro ao carregar sua imagem. Tente outro arquivo.");
            loadingMessage.style.display = 'none';
             imageLoader.value = ''; // Limpa o input
        };
        userImage.src = e.target.result; // Define o src da imagem do usuário
    };

    reader.onerror = () => {
        console.error("Erro ao ler o arquivo.");
        alert("Não foi possível ler o arquivo selecionado.");
         loadingMessage.style.display = 'none';
         imageLoader.value = ''; // Limpa o input
    };

    reader.readAsDataURL(file); // Lê o arquivo como Data URL
});

// Listener para o botão de download
downloadBtn.addEventListener('click', () => {
    if (!userImage) return; // Não faz nada se não houver imagem

    // Cria um link temporário
    const link = document.createElement('a');

    // Define o Href com os dados da imagem do canvas (em formato PNG)
    link.href = canvas.toDataURL('image/png'); // Use 'image/jpeg' se preferir JPG

    // Define o nome do arquivo para download
    link.download = outputFilename;

    // Simula um clique no link para iniciar o download
    document.body.appendChild(link); // Necessário para Firefox
    link.click();
    document.body.removeChild(link); // Limpa o link temporário
});


// --- Funcionalidade de Compartilhamento (Web Share API) ---

function prepareShare() {
    // Verifica se a Web Share API está disponível
    if (navigator.share) {
         // Converte o canvas para Blob (melhor para compartilhar que Data URL)
        canvas.toBlob( (blob) => {
            if (blob) {
                combinedImageBlob = blob;
                 shareBtn.style.display = 'inline-block'; // Mostra o botão
            } else {
                console.error("Falha ao criar Blob da imagem.");
                shareBtn.style.display = 'none';
            }
        }, 'image/png'); // O tipo MIME deve corresponder ao formato desejado

    } else {
        console.log("Web Share API não suportada neste navegador.");
        shareBtn.style.display = 'none'; // Esconde o botão se não for suportado
    }
}

shareBtn.addEventListener('click', async () => {
    if (!combinedImageBlob) {
        alert("A imagem ainda não está pronta para compartilhar.");
        return;
    }

    const shareData = {
        files: [
             new File([combinedImageBlob], outputFilename, { type: combinedImageBlob.type })
        ],
        title: 'Minha Imagem Personalizada',
        text: 'Veja a imagem que criei!',
        // url: 'https://seu-site.com' // Opcional: adicione um link para seu site
    };

    try {
        await navigator.share(shareData);
        console.log('Imagem compartilhada com sucesso!');
    } catch (err) {
        // O erro 'AbortError' geralmente significa que o usuário cancelou o compartilhamento
        if (err.name !== 'AbortError') {
            console.error('Erro ao compartilhar:', err);
             alert(`Erro ao compartilhar: ${err.message}`);
        } else {
            console.log('Compartilhamento cancelado pelo usuário.');
        }
    }
});

// Pré-carrega o template ao iniciar (opcional, mas melhora a percepção de velocidade)
// Comentado para evitar erro se o script carregar antes do DOM, mas pode ser útil
// window.addEventListener('load', () => {
//     loadTemplateImage().catch(err => {}); // Carrega e ignora erro inicial se houver
// });
