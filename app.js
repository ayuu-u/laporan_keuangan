
const $ = (id) => document.getElementById(id);
const storageKey = 'bloomFinanceTransactions';

let transactions = loadTransactions();
let cashChart = null;
let reportChart = null;

function loadTransactions() {
    try {
        const saved = localStorage.getItem(storageKey);
        const data = saved ? JSON.parse(saved) : [];
        return Array.isArray(data) ? data : [];
    } catch {
        return [];
    }
}

function saveTransactions() {
    localStorage.setItem(storageKey, JSON.stringify(transactions));
}

function rupiah(value) {
    return 'Rp ' + Number(value).toLocaleString('id-ID');
}

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[char]);
}

function currentMonth(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthTransactions() {
    const month = currentMonth();
    return transactions.filter(t => t.date.startsWith(month));
}

function total(type, data = transactions) {
    return data
        .filter(t => t.type === type)
        .reduce((sum, t) => sum + Number(t.amount), 0);
}

function dateLabel(date) {
    return new Date(date + 'T00:00:00').toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
}

function sorted(data) {
    return [...data].sort((a, b) =>
        b.date.localeCompare(a.date) || b.id - a.id
    );
}

function renderTable(data, target, showActions = true) {
    const container = $(target);

    if (!data.length) {
        container.innerHTML = '<div class="empty">Belum ada transaksi. Yuk, tambahkan transaksi pertamamu! ♡</div>';
        return;
    }

    container.innerHTML = `
        <div class="table-wrap">
        <table>
            <thead>
                <tr>
                    <th>Keterangan</th>
                    <th>Kategori</th>
                    <th>Tanggal</th>
                    <th>Jenis</th>
                    <th>Nominal</th>
                    ${showActions ? '<th>Aksi</th>' : ''}
                </tr>
            </thead>
            <tbody>
            ${sorted(data).map(t => `
                <tr>
                    <td>${escapeHTML(t.description)}</td>
                    <td>${escapeHTML(t.category)}</td>
                    <td>${dateLabel(t.date)}</td>
                    <td>
                        <span class="type-pill ${t.type === 'pemasukan' ? 'type-in' : 'type-out'}">
                            ${t.type === 'pemasukan' ? 'Pendapatan' : 'Pengeluaran'}
                        </span>
                    </td>
                    <td class="amount ${t.type === 'pemasukan' ? 'green' : 'red'}">
                        ${t.type === 'pemasukan' ? '+' : '-'}${rupiah(t.amount)}
                    </td>
                    ${showActions ? `
                    <td>
                        <div class="actions">
                            <button class="btn-edit" data-action="edit" data-id="${t.id}">Edit</button>
                            <button class="btn-delete" data-action="delete" data-id="${t.id}">Hapus</button>
                        </div>
                    </td>` : ''}
                </tr>
            `).join('')}
            </tbody>
        </table>
        </div>
    `;
}

function renderDashboard() {
    const monthData = monthTransactions();

    $('totalIncome').textContent = rupiah(total('pemasukan', monthData));
    $('totalExpense').textContent = rupiah(total('pengeluaran', monthData));
    $('totalBalance').textContent = rupiah(total('pemasukan') - total('pengeluaran'));
    $('totalCount').textContent = transactions.length.toLocaleString('id-ID');

    $('reportIncome').textContent = rupiah(total('pemasukan'));
    $('reportExpense').textContent = rupiah(total('pengeluaran'));
    $('reportBalance').textContent = rupiah(total('pemasukan') - total('pengeluaran'));

    renderTable(sorted(transactions).slice(0, 5), 'recentTransactions', false);

    renderChart('cashFlowChart', 'cash');
    renderChart('reportChart', 'report');
}

function renderChart(canvasId, chartType) {
    const canvas = $(canvasId);
    if (!canvas || typeof Chart === 'undefined') return;

    const months = [];

    for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setDate(1);
        d.setMonth(d.getMonth() - i);

        months.push({
            key: currentMonth(d),
            label: d.toLocaleDateString('id-ID', {
                month: 'short',
                year: '2-digit'
            })
        });
    }

    const incomeData = months.map(m =>
        total('pemasukan', transactions.filter(t => t.date.startsWith(m.key)))
    );

    const expenseData = months.map(m =>
        total('pengeluaran', transactions.filter(t => t.date.startsWith(m.key)))
    );

    const oldChart = chartType === 'cash' ? cashChart : reportChart;
    if (oldChart) oldChart.destroy();

    const chart = new Chart(canvas, {
        type: 'line',
        data: {
            labels: months.map(m => m.label),
            datasets: [
                {
                    label: 'Pendapatan',
                    data: incomeData,
                    borderColor: '#d985a2',
                    backgroundColor: 'rgba(217,133,162,.12)',
                    fill: true,
                    tension: .35,
                    borderWidth: 2,
                    pointRadius: 3
                },
                {
                    label: 'Pengeluaran',
                    data: expenseData,
                    borderColor: '#e9b3bd',
                    backgroundColor: 'rgba(233,179,189,.08)',
                    fill: true,
                    tension: .35,
                    borderWidth: 2,
                    pointRadius: 3
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { intersect: false, mode: 'index' },
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { usePointStyle: true, boxWidth: 7, padding: 18 }
                },
                tooltip: {
                    callbacks: {
                        label: context =>
                            `${context.dataset.label}: ${rupiah(context.raw)}`
                    }
                }
            },
            scales: {
                x: { grid: { display: false } },
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: value => rupiah(value)
                    }
                }
            }
        }
    });

    if (chartType === 'cash') cashChart = chart;
    else reportChart = chart;
}

function renderAll() {
    renderDashboard();

    const query = $('searchInput').value.toLowerCase().trim();
    const filter = $('filterType').value;

    const filtered = transactions.filter(t => {
        const matchesQuery =
            `${t.description} ${t.category}`.toLowerCase().includes(query);
        const matchesType = filter === 'semua' || t.type === filter;
        return matchesQuery && matchesType;
    });

    renderTable(filtered, 'allTransactions');
    renderTable(
        transactions.filter(t => t.type === 'pemasukan'),
        'incomeList'
    );
    renderTable(
        transactions.filter(t => t.type === 'pengeluaran'),
        'expenseList'
    );
}

function openModal(type = 'pemasukan', id = null) {
    $('transactionForm').reset();
    $('transactionId').value = '';
    $('formError').textContent = '';

    const today = new Date();
    const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    $('date').value = todayString;
    $('type').value = type;

    if (id !== null) {
        const transaction = transactions.find(t => t.id === Number(id));
        if (!transaction) return;

        $('transactionId').value = transaction.id;
        $('type').value = transaction.type;
        $('description').value = transaction.description;
        $('category').value = transaction.category;
        $('amount').value = transaction.amount;
        $('date').value = transaction.date;
        $('modalTitle').textContent = 'Edit Transaksi';
    } else {
        $('modalTitle').textContent = 'Tambah Transaksi';
    }

    $('transactionModal').classList.remove('hidden');
}

function closeModal() {
    $('transactionModal').classList.add('hidden');
}

function showPage() {
    const id = location.hash.slice(1) || 'dashboard';
    const allowed = ['dashboard', 'transaksi', 'pendapatan', 'pengeluaran', 'laporan'];
    const page = allowed.includes(id) ? id : 'dashboard';

    document.querySelectorAll('.page').forEach(section => {
        section.classList.toggle('hidden', section.id !== page);
    });

    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.toggle('active', link.getAttribute('href') === `#${page}`);
    });

    const titles = {
        dashboard: 'Dashboard',
        transaksi: 'Transaksi',
        pendapatan: 'Pendapatan',
        pengeluaran: 'Pengeluaran',
        laporan: 'Laporan'
    };

    $('pageTitle').textContent = titles[page];
    renderAll();
}

$('transactionForm').addEventListener('submit', event => {
    event.preventDefault();

    const id = $('transactionId').value;
    const description = $('description').value.trim();
    const amount = Number($('amount').value);
    const date = $('date').value;

    if (!description || !Number.isSafeInteger(amount) || amount <= 0 || !date) {
        $('formError').textContent = 'Periksa kembali keterangan, nominal, dan tanggal.';
        return;
    }

    const data = {
        type: $('type').value,
        description,
        category: $('category').value,
        amount,
        date
    };

    if (id) {
        const index = transactions.findIndex(t => t.id === Number(id));
        if (index !== -1) {
            transactions[index] = { ...transactions[index], ...data };
        }
    } else {
        transactions.push({ id: Date.now(), ...data });
    }

    saveTransactions();
    closeModal();
    renderAll();
});

document.addEventListener('click', event => {
    const button = event.target.closest('[data-action]');
    if (!button) return;

    const id = Number(button.dataset.id);

    if (button.dataset.action === 'edit') {
        const transaction = transactions.find(t => t.id === id);
        if (transaction) openModal(transaction.type, id);
    }

    if (button.dataset.action === 'delete') {
        const transaction = transactions.find(t => t.id === id);
        if (!transaction) return;

        if (confirm(`Hapus transaksi "${transaction.description}"?`)) {
            transactions = transactions.filter(t => t.id !== id);
            saveTransactions();
            renderAll();
        }
    }
});

$('addTop').addEventListener('click', () => openModal());
$('addTransaction').addEventListener('click', () => openModal());
$('closeModal').addEventListener('click', closeModal);
$('cancelModal').addEventListener('click', closeModal);

$('transactionModal').addEventListener('click', event => {
    if (event.target === $('transactionModal')) closeModal();
});

document.querySelectorAll('[data-type]').forEach(button => {
    button.addEventListener('click', () => openModal(button.dataset.type));
});

$('searchInput').addEventListener('input', renderAll);
$('filterType').addEventListener('change', renderAll);
window.addEventListener('hashchange', showPage);

showPage();
