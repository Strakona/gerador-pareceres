// Gerenciamento de páginas
const pages = {
    home: document.getElementById('home-page'),
    upload: document.getElementById('upload-page'),
    form: document.getElementById('form-page'),
    results: document.getElementById('results-page')
};

// Estado da aplicação
const appState = {
    currentPage: 'home',
    students: [],
    evaluations: {},
    progress: 0
};

// Navegação entre páginas
function showPage(pageId) {
    Object.values(pages).forEach(page => page.classList.add('d-none'));
    pages[pageId].classList.remove('d-none');
    appState.currentPage = pageId;
}

// Event Listeners
document.getElementById('start-btn').addEventListener('click', () => showPage('upload'));

// Manipulação de Upload de Arquivo
document.getElementById('file-upload').addEventListener('change', handleFileUpload);

async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
        if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
            const data = await readExcelFile(file);
            appState.students = parseExcelData(data);
        } else {
            const data = await readFile(file);
            appState.students = parseCSVData(data);
        }
        
        displayPreview(appState.students);
        showUploadSuccess();
    } catch (error) {
        console.error('Erro ao processar arquivo:', error);
        showError('Erro ao processar o arquivo. Certifique-se de que está no formato correto.');
    }
}

function readExcelFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                resolve(jsonData);
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = (e) => reject(e);
        reader.readAsArrayBuffer(file);
    });
}

function readFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(e);
        reader.readAsText(file, 'UTF-8');
    });
}

function parseExcelData(data) {
    // Remove linhas vazias e cabeçalho
    const rows = data.filter(row => row && row.length > 0);
    const header = rows[0];
    const dataRows = rows.slice(2); // Pula o cabeçalho e a linha de títulos

    return dataRows
        .filter(row => row[0]) // Filtra linhas sem nome
        .map(row => {
            const nome = row[0]?.toString().trim();
            const dataNascimento = formatarData(row[1]);
            
            return {
                nome,
                dataNascimento,
                idade: dataNascimento ? calcularIdade(dataNascimento) : null
            };
        });
}

function parseCSVData(data) {
    const lines = data.split('\n')
        .filter(line => line.trim())
        .map(line => line.split(','));

    // Remove o cabeçalho
    const header = lines.shift();
    
    return lines
        .filter(line => line[0]) // Filtra linhas sem nome
        .map(line => {
            const nome = line[0].trim();
            const dataNascimento = formatarData(line[1]);
            
            return {
                nome,
                dataNascimento,
                idade: dataNascimento ? calcularIdade(dataNascimento) : null
            };
        });
}

function formatarData(data) {
    if (!data) return null;
    
    // Se for um número serial do Excel
    if (typeof data === 'number') {
        const date = XLSX.SSF.parse_date_code(data);
        return `${padZero(date.d)}/${padZero(date.m)}/${date.y}`;
    }
    
    // Se já estiver no formato dd/mm/yy ou dd/mm/yyyy
    if (typeof data === 'string' && data.includes('/')) {
        return data;
    }
    
    return null;
}

function padZero(num) {
    return num.toString().padStart(2, '0');
}

function calcularIdade(dataNascimento) {
    // Converte a data do formato dd/mm/aa para um objeto Date
    const [dia, mes, ano] = dataNascimento.split('/').map(Number);
    const anoCompleto = ano < 100 ? 2000 + ano : ano; // Assume que anos menores que 100 são do século 21
    const dateNascimento = new Date(anoCompleto, mes - 1, dia);
    
    const hoje = new Date();
    let idade = hoje.getFullYear() - dateNascimento.getFullYear();
    
    // Ajusta a idade se ainda não fez aniversário este ano
    const m = hoje.getMonth() - dateNascimento.getMonth();
    if (m < 0 || (m === 0 && hoje.getDate() < dateNascimento.getDate())) {
        idade--;
    }
    
    return idade;
}

function displayPreview(students) {
    const container = document.getElementById('preview-container');
    const table = document.getElementById('preview-table');
    
    container.classList.remove('d-none');
    
    const html = `
        <thead>
            <tr>
                <th>Nome do Aluno</th>
                <th>Data de Nascimento</th>
                <th>Idade</th>
            </tr>
        </thead>
        <tbody>
            ${students.map(student => `
                <tr>
                    <td>${student.nome}</td>
                    <td>${student.dataNascimento}</td>
                    <td>${student.idade} anos</td>
                </tr>
            `).join('')}
        </tbody>
    `;
    
    table.innerHTML = html;
    
    // Adiciona botão para continuar
    if (!document.getElementById('continue-btn')) {
        const btn = document.createElement('button');
        btn.id = 'continue-btn';
        btn.className = 'btn btn-primary mt-3';
        btn.textContent = 'Continuar para Avaliação';
        btn.onclick = () => {
            populateStudentSelect();
            showPage('form');
        };
        container.appendChild(btn);
    }
}

// Formulário de Avaliação
function populateStudentSelect() {
    const select = document.getElementById('student-select');
    select.innerHTML = `
        <option value="">Selecione um aluno</option>
        ${appState.students.map(student => `
            <option value="${student.nome}">${student.nome}</option>
        `).join('')}
    `;
}

document.getElementById('evaluation-form').addEventListener('submit', handleFormSubmit);

function handleFormSubmit(event) {
    event.preventDefault();
    
    const studentName = document.getElementById('student-select').value;
    const behavior = document.getElementById('behavior').value;
    const academic = document.getElementById('academic').value;
    const action = event.submitter.value; // Pega o valor do botão clicado
    
    if (!studentName || !behavior || !academic) {
        showError('Por favor, preencha todos os campos obrigatórios.');
        return;
    }
    
    appState.evaluations[studentName] = {
        behavior,
        academic,
        comments: {
            behavior: event.target.querySelector('textarea').value,
            academic: event.target.querySelectorAll('textarea')[1].value
        }
    };
    
    updateProgress();
    generateReport(studentName);
    showSuccess('Avaliação salva com sucesso!');
    
    // Decide o próximo passo baseado no botão clicado
    if (action === 'finish') {
        showPage('results');
    } else {
        // Reseta o formulário
        event.target.reset();
        
        // Encontra o próximo aluno não avaliado
        const nextStudent = findNextStudent();
        if (nextStudent) {
            // Se houver próximo aluno, seleciona ele automaticamente
            document.getElementById('student-select').value = nextStudent;
        } else {
            // Se não houver mais alunos para avaliar, vai para a página de resultados
            showPage('results');
        }
    }
}

function findNextStudent() {
    const evaluatedStudents = Object.keys(appState.evaluations);
    const nextStudent = appState.students.find(student => 
        !evaluatedStudents.includes(student.nome)
    );
    return nextStudent ? nextStudent.nome : null;
}

function updateProgress() {
    const total = appState.students.length;
    const completed = Object.keys(appState.evaluations).length;
    appState.progress = (completed / total) * 100;
    
    const progressBar = document.querySelector('.progress-bar');
    progressBar.style.width = `${appState.progress}%`;
    
    if (completed === total) {
        showPage('results');
    }
}

// Geração de Relatórios
function generateReport(studentName) {
    const student = appState.students.find(s => s.nome === studentName);
    const evaluation = appState.evaluations[studentName];
    const container = document.getElementById('reports-container');
    
    const reportCard = document.createElement('div');
    reportCard.className = 'report-card';
    reportCard.innerHTML = `
        <h3>${student.nome}</h3>
        <p><small>Idade: ${student.idade} anos</small></p>
        <p><strong>Comportamento:</strong> ${evaluation.behavior}</p>
        ${evaluation.comments.behavior ? `<p><em>Observações: ${evaluation.comments.behavior}</em></p>` : ''}
        <p><strong>Desempenho Acadêmico:</strong> ${evaluation.academic}</p>
        ${evaluation.comments.academic ? `<p><em>Observações: ${evaluation.comments.academic}</em></p>` : ''}
        <div class="mt-3">
            <button class="btn btn-primary btn-sm" onclick="downloadPDF('${studentName}')">
                Baixar PDF
            </button>
            <button class="btn btn-secondary btn-sm" onclick="editReport('${studentName}')">
                Editar
            </button>
        </div>
    `;
    
    container.appendChild(reportCard);
}

// Funções de Feedback
function showSuccess(message) {
    showFeedback(message, 'success');
}

function showError(message) {
    showFeedback(message, 'danger');
}

function showUploadSuccess() {
    showSuccess('Arquivo carregado com sucesso!');
}

function showFeedback(message, type) {
    const alert = document.createElement('div');
    alert.className = `alert alert-${type} alert-dismissible fade show`;
    alert.role = 'alert';
    alert.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    const currentPage = pages[appState.currentPage];
    currentPage.insertBefore(alert, currentPage.firstChild);
    
    setTimeout(() => alert.remove(), 5000);
}

// Funções para implementar posteriormente
function downloadPDF(studentName) {
    const student = appState.students.find(s => s.nome === studentName);
    const evaluation = appState.evaluations[studentName];
    
    if (!student || !evaluation) {
        showError('Erro ao gerar PDF. Dados do aluno não encontrados.');
        return;
    }

    const parecer = generateDetailedReport(student, evaluation);

    // Configuração do PDF
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Cabeçalho
    doc.setFontSize(16);
    doc.text('Escola Liomar Gomes', 105, 20, { align: 'center' });
    
    doc.setFontSize(14);
    doc.text('Parecer Pedagógico', 105, 30, { align: 'center' });
    
    // Informações do aluno
    doc.setFontSize(12);
    doc.text(`Aluno(a): ${student.nome}`, 20, 50);
    doc.text(`Idade: ${student.idade} anos`, 20, 60);
    doc.text(`Data de Nascimento: ${student.dataNascimento}`, 20, 70);
    
    // Parecer
    const splitParecer = doc.splitTextToSize(parecer, 170);
    doc.text(splitParecer, 20, 90);
    
    // Rodapé
    const data = new Date().toLocaleDateString();
    doc.text(`Data: ${data}`, 20, doc.internal.pageSize.height - 30);
    doc.text('_____________________________', 105, doc.internal.pageSize.height - 40, { align: 'center' });
    doc.text('Professor(a)', 105, doc.internal.pageSize.height - 30, { align: 'center' });

    // Download do PDF
    doc.save(`parecer_${student.nome.replace(/\s+/g, '_').toLowerCase()}.pdf`);
    showSuccess('PDF gerado com sucesso!');
}

function editReport(studentName) {
    // Implementar edição de relatório
    alert('Função de edição será implementada em breve.');
}

function generateDetailedReport(student, evaluation) {
    const comportamentoTexts = {
        excelente: [
            `${student.nome} demonstra um comportamento exemplar em sala de aula`,
            "apresenta excelente capacidade de trabalho em equipe",
            "mantém uma postura respeitosa e colaborativa",
            "contribui positivamente para o ambiente de aprendizagem"
        ],
        bom: [
            `${student.nome} apresenta bom comportamento em sala`,
            "demonstra boa capacidade de interação com colegas",
            "geralmente segue as orientações propostas",
            "mantém uma postura adequada durante as aulas"
        ],
        regular: [
            `${student.nome} apresenta comportamento regular em sala`,
            "por vezes necessita de orientação para manter o foco",
            "demonstra momentos de participação positiva",
            "tem potencial para melhorar sua postura em sala"
        ],
        "precisa-melhorar": [
            `${student.nome} necessita desenvolver melhor comportamento em sala`,
            "requer atenção frequente para manter o foco nas atividades",
            "precisa trabalhar sua interação com colegas",
            "necessita de maior comprometimento com as regras da sala"
        ]
    };

    const desempenhoTexts = {
        excelente: [
            "demonstra excelente compreensão dos conteúdos trabalhados",
            "apresenta notável desenvolvimento nas atividades propostas",
            "possui destacada capacidade de aprendizagem",
            "supera as expectativas nas avaliações realizadas"
        ],
        bom: [
            "demonstra boa compreensão dos conteúdos",
            "realiza as atividades propostas com dedicação",
            "apresenta desenvolvimento satisfatório",
            "atinge os objetivos estabelecidos para o período"
        ],
        regular: [
            "demonstra compreensão básica dos conteúdos",
            "realiza as atividades com auxílio quando necessário",
            "apresenta desenvolvimento gradual nas habilidades trabalhadas",
            "atinge parcialmente os objetivos propostos"
        ],
        "precisa-melhorar": [
            "necessita de maior dedicação aos estudos",
            "requer acompanhamento constante nas atividades",
            "apresenta dificuldades na compreensão dos conteúdos",
            "precisa desenvolver melhor as habilidades básicas"
        ]
    };

    const comportamentoBase = comportamentoTexts[evaluation.behavior];
    const desempenhoBase = desempenhoTexts[evaluation.academic];

    let parecer = `Parecer Pedagógico - ${new Date().toLocaleDateString()}\n\n`;
    parecer += `${student.nome}, ${student.idade} anos, `;
    
    // Comportamento
    parecer += comportamentoBase[0] + ". " + 
               comportamentoBase[Math.floor(Math.random() * (comportamentoBase.length - 1) + 1)] + ". ";
    
    if (evaluation.comments.behavior) {
        parecer += evaluation.comments.behavior + ". ";
    }

    // Desempenho
    parecer += "\n\nQuanto ao desempenho acadêmico, o(a) aluno(a) " + 
               desempenhoBase[0] + ". " +
               desempenhoBase[Math.floor(Math.random() * (desempenhoBase.length - 1) + 1)] + ". ";
    
    if (evaluation.comments.academic) {
        parecer += evaluation.comments.academic + ". ";
    }

    // Conclusão
    const conclusoes = {
        excelente: "Parabéns pelo excelente desenvolvimento!",
        bom: "Continue com o bom trabalho!",
        regular: "Continue se esforçando para melhorar ainda mais.",
        "precisa-melhorar": "Contamos com seu empenho para superar os desafios identificados."
    };

    parecer += `\n\n${conclusoes[evaluation.academic]}`;

    return parecer;
} 