// 期待値ラインを描画するプラグイン
const expectedLinePlugin = {
    id: 'expectedLine',
    afterDraw(chart, args, options) {
        const { ctx, chartArea: { top, bottom }, scales: { x } } = chart;

        const expected = options.value;

        if (expected == null) return;

        // x軸はカテゴリなのでインデックスに変換
        const index = chart.data.labels.findIndex(v => Number(v) === Math.round(expected));

        if (index === -1) return;

        const xPos = x.getPixelForValue(index);

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(xPos, top);
        ctx.lineTo(xPos, bottom);
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'red';
        ctx.stroke();

        // ラベル
        ctx.fillStyle = 'red';
        ctx.fillText(`期待値: ${expected.toFixed(2)}`, xPos + 5, top + 10);

        ctx.restore();
    }
};

const percentileLinePlugin = {
    id: 'percentileLine',
    afterDraw(chart, args, options) {
        const { ctx, chartArea: { top, bottom }, scales: { x } } = chart;

        const lines = options.lines || [];

        lines.forEach(line => {
            const value = line.value;
            if (value == null) return;

            const index = chart.data.labels.findIndex(v => Number(v) === Math.round(value));
            if (index === -1) return;

            const xPos = x.getPixelForValue(index);

            ctx.save();
            ctx.beginPath();
            ctx.moveTo(xPos, top);
            ctx.lineTo(xPos, bottom);
            ctx.lineWidth = 2;
            ctx.strokeStyle = line.color || 'red';
            ctx.stroke();

            ctx.fillStyle = line.color || 'red';
            ctx.fillText(line.label, xPos + 5, top + 10);

            ctx.restore();
        });
    }
};

let chartInstance = null;

// 分布グラフの描画
function drawChart(dist, trials, expectedTrials) {
    const sortedKeys = Object.keys(dist)
        .map(Number)
        .sort((a, b) => a - b);

    const maxDisplay = Math.ceil(expectedTrials * 3);
    const filteredKeys = sortedKeys.filter(k => k <= maxDisplay);

    const labels = filteredKeys;
    const data = filteredKeys.map(k => (dist[k] / trials) * 100);

    // --- パーセンタイル計算 ---
    const p90 = getPercentile(dist, trials, 0.9);
    const p99 = getPercentile(dist, trials, 0.99);

    const ctx = document.getElementById('distributionChart').getContext('2d');

    if (chartInstance) {
        chartInstance.destroy();
    }

    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: '確率 (%)',
                data: data
            }]
        },
        plugins: [percentileLinePlugin],
        options: {
            responsive: true,
            plugins: {
                percentileLine: {
                    lines: [
                        {
                            value: expectedTrials,
                            color: 'red',
                            label: `平均: ${expectedTrials.toFixed(2)}`
                        },
                        {
                            value: p90,
                            color: 'blue',
                            label: `90%: ${p90}回`
                        },
                        {
                            value: p99,
                            color: 'green',
                            label: `99%: ${p99}回`
                        }
                    ]
                },
                tooltip: {
                    callbacks: {
                        label: (context) => context.parsed.y.toFixed(3) + '%'
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: '試行回数'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: '確率 (%)'
                    },
                    beginAtZero: true
                }
            }
        }
    });
}

// 調和級数の計算
function harmonicSum(n) {
    let sum = 0;
    for (let k = 1; k <= n; k++) {
        sum += 1 / k;
    }
    return sum;
}

// N!の対数を計算
function logFactorial(n) {
    let logSum = 0;
    for (let i = 1; i <= n; i++) {
        logSum += Math.log(i);
    }
    return logSum;
}

// 確率のフォーマット
function formatProbability(value) {
    if (value < 1e-16) {
        return value.toExponential(16) + '%';
    }
    return value.toFixed(16).replace(/\.0+$/, '') + '%';
}

// シミュレーション関数
function simulateOnce(n) {
    const collected = new Set();
    let count = 0;

    while (collected.size < n) {
        const item = Math.floor(Math.random() * n);
        collected.add(item);
        count++;
    }

    return count;
}

// 分布のシミュレーション
function simulateDistribution(n, trials = 50000) {
    const dist = {};

    for (let i = 0; i < trials; i++) {
        const result = simulateOnce(n);
        dist[result] = (dist[result] || 0) + 1;
    }

    return dist;
}

// 分布の表示
function displayDistribution(dist, trials) {
    const sortedKeys = Object.keys(dist)
        .map(Number)
        .sort((a, b) => a - b);

    let output = '';

    sortedKeys.forEach(k => {
        const prob = dist[k] / trials;
        output += `${k}回: ${(prob * 100).toFixed(2)}%\n`;
    });

    document.getElementById('distribution').textContent = output;
}

// パーセンタイルの計算
function getPercentile(dist, trials, p) {
    const sortedKeys = Object.keys(dist)
        .map(Number)
        .sort((a, b) => a - b);

    let cumulative = 0;

    for (let k of sortedKeys) {
        cumulative += dist[k];
        if (cumulative / trials >= p) {
            return k;
        }
    }

    return sortedKeys[sortedKeys.length - 1];
}

// 計算の実行
function calculate() {
    const itemCount = parseInt(document.getElementById('itemCount').value);
    const itemCost = parseInt(document.getElementById('itemCost').value);

    // 確率計算 (log(N!) - N * log(N))
    let logP = logFactorial(itemCount) - itemCount * Math.log(itemCount);
    let probability = Math.exp(logP);

    // 達成人数の期待値
    let success100 = 100 * probability;
    let success1000 = 1000 * probability;
    let success10000 = 10000 * probability;
    let success100000 = 100000 * probability;

    // 期待試行回数 (N × 調和級数)
    let expectedTrials = itemCount * harmonicSum(itemCount);

    // 期待コスト
    let expectedCost = expectedTrials * itemCost;

    // 分布計算
    const trials = 30000; // 重すぎない値
    const dist = simulateDistribution(itemCount, trials);
    drawChart(dist, trials, expectedTrials);

    // パーセンタイルの計算
    const p90 = getPercentile(dist, trials, 0.9);
    const p99 = getPercentile(dist, trials, 0.99);

    // パーセンタイルに到達するまでのコスト
    const cost90 = p90 * itemCost;
    const cost99 = p99 * itemCost;

    // 結果の表示
    document.getElementById('expectedTrials').textContent = expectedTrials.toFixed(2);
    document.getElementById('expectedCost').textContent = expectedCost.toFixed(2);
    document.getElementById('p90Text').textContent = p90;
    document.getElementById('p99Text').textContent = p99;
    document.getElementById('cost90Text').textContent = cost90.toFixed(2);
    document.getElementById('cost99Text').textContent = cost99.toFixed(2);
}

// イベントリスナーを設定
document.getElementById('itemCount').addEventListener('input', calculate);
document.getElementById('itemCost').addEventListener('input', calculate);

// 初回実行
calculate();
