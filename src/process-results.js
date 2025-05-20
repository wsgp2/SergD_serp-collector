/**
 * Скрипт для обработки и объединения уже собранных результатов
 * Создает итоговый файл без повторного обращения к API
 */

const fs = require('fs').promises;
const path = require('path');
const { existsSync, readdirSync } = require('fs');

// Путь к директории с результатами
const RESULTS_DIR = '/Users/wsgp/SergD_serp-collector/data/results';
// В нашем случае исходные файлы и целевая папка совпадают
const SOURCE_RESULTS_DIR = RESULTS_DIR;

/**
 * Фильтрует агрегаторы и банки из результатов поиска
 * @param {Array} results - Массив с результатами поиска
 * @returns {Array} - Отфильтрованный массив
 */
function filterAggregatorsAndBanks(results) {
  // Список доменов агрегаторов и банков, которые нужно исключить
  const excludeDomains = [
    // Агрегаторы
    'banki.ru', 
    'sravni.ru', 
    'bankiros.ru', 
    'vbr.ru', 
    'sreavu.ru',
    '13min.ru',
    'brobank.ru',
    'viberu.ru',
    'calculator-credit.ru',
    'kredity.ru',
    'consultant.ru',
    'rbc.ru',
    'financer.com',
    'bankstoday.net',
    
    // Банки
    'sberbank.ru',
    'vtb.ru',
    'alfabank.ru',
    'gazprombank.ru',
    'raiffeisen.ru',
    'rshb.ru',
    'tinkoff.ru',
    'open.ru',
    'otpbank.ru',
    'psbank.ru',
    'mkb.ru',
    'sovcombank.ru',
    'unicredit.ru',
    'citibank.ru',
    'pochtabank.ru',
    'uralsib.ru',
    'rosbank.ru',
    'roscap.ru',
    'homecredit.ru',
    'bancaintesa.ru',
    'bspb.ru',
    'absolutbank.ru',
    'mtsbank.ru',
    'ing.ru',
    'zenit.ru',
    'bank-hlynov.ru',
    'credit-suisse.com',
    'tkbbank.ru',
    'tbank.ru',
    'belgazzprombank.by',
    'belgazprombank.by',
    'myfin.by',
    'mtbank.by',
    'rsb.ru',
    'dtb1.ru',
    'nskbl.ru',
    'norvikbank.ru',
    'tatsotsbank.ru',
    'abank.ru',
    'ingobank.ru',
    'svoi.ru',
    'ubrir.ru',
    'creditural.ru',
    'samolet.ru',
    'ogrz.ru',
    'akbars.ru',
    'touchka.com',
    'royalfinance.ru',
    'finuslugi.ru',
    'vsezaimyonline.ru',
    'ubrr.ru',
    'tochka.com',
    'business.yandex',
    'blog.domclick.ru',
    'bki-okb.ru',
    'kontur.ru',
    'finlab.ru',
    'bank',
    '.bank',
    'vtbbiz',
    'sberbank',
    'vtb',
    'alfabank',
    'tinkoff',
    'royal finance'
  ];
  
  return results.filter(result => {
    if (!result.domain) return false;
    
    // Проверяем, что домен не содержит ни один из исключаемых доменов
    return !excludeDomains.some(excludeDomain => 
      result.domain.includes(excludeDomain)
    );
  });
}

/**
 * Удаляет дубликаты сайтов по домену
 * @param {Array} results - Массив с результатами поиска
 * @returns {Array} - Массив без дубликатов
 */
function removeDuplicateDomains(results) {
  const uniqueDomains = {};
  const uniqueResults = [];
  
  for (const result of results) {
    if (!uniqueDomains[result.domain]) {
      uniqueDomains[result.domain] = true;
      uniqueResults.push(result);
    }
  }
  
  return uniqueResults;
}

/**
 * Создает CSV файл с доменами для системы перехвата
 * @param {Array} sites - Массив сайтов
 * @returns {Promise<void>}
 */
async function createCsvForIntercept(sites) {
  try {
    // Формируем заголовок CSV
    let csvContent = 'domain,title,url,snippet\n';
    
    // Добавляем данные о каждом сайте
    sites.forEach(site => {
      // Экранируем кавычки в заголовке и сниппете
      const safeTitle = site.title ? site.title.replace(/"/g, '""') : '';
      const safeSnippet = site.snippet ? site.snippet.replace(/"/g, '""') : '';
      
      csvContent += `${site.domain},"${safeTitle}","${site.url}","${safeSnippet}"\n`;
    });
    
    // Сохраняем CSV файл
    const csvPath = path.join(RESULTS_DIR, 'domains_for_intercept.csv');
    await fs.writeFile(csvPath, csvContent, 'utf8');
    console.log(`✅ CSV файл для системы перехвата создан: ${csvPath}`);
  } catch (error) {
    console.error('❌ Ошибка при создании CSV файла:', error.message);
  }
}

/**
 * Основная функция для обработки существующих результатов
 */
async function processResults() {
  console.log('🚀 Запуск обработки существующих результатов...');
  
  // Создаем директорию для результатов, если она не существует
  if (!existsSync(RESULTS_DIR)) {
    require('fs').mkdirSync(RESULTS_DIR, { recursive: true });
  }
  
  try {
    // Получаем список всех файлов с результатами SerpAPI
    const files = readdirSync(SOURCE_RESULTS_DIR)
      .filter(file => file.startsWith('serpapi_') && file.endsWith('.json'));
    
    console.log(`📂 Найдено ${files.length} файлов с результатами`);
    
    // Массив для всех результатов
    let allResults = [];
    
    // Обрабатываем каждый файл
    for (const file of files) {
      try {
        const filePath = path.join(SOURCE_RESULTS_DIR, file);
        const content = await fs.readFile(filePath, 'utf8');
        const results = JSON.parse(content);
        
        // Добавляем результаты в общий массив
        allResults = [...allResults, ...results];
        
        console.log(`✅ Обработан файл: ${file} (${results.length} результатов)`);
      } catch (error) {
        console.error(`❌ Ошибка при обработке файла ${file}:`, error.message);
      }
    }
    
    // Фильтруем агрегаторы и банки, удаляем дубликаты
    const filteredResults = filterAggregatorsAndBanks(allResults);
    const uniqueResults = removeDuplicateDomains(filteredResults);
    
    // Сохраняем итоговый результат
    const finalResultsPath = path.join(RESULTS_DIR, 'final_results.json');
    await fs.writeFile(finalResultsPath, JSON.stringify(uniqueResults, null, 2));
    console.log(`💾 Финальные результаты сохранены в ${finalResultsPath}`);
    
    // Создаем CSV для системы перехвата
    await createCsvForIntercept(uniqueResults);
    
    // Сохраняем статистику
    const stats = {
      totalFiles: files.length,
      totalResults: allResults.length,
      filteredResults: filteredResults.length,
      uniqueResults: uniqueResults.length,
      processDate: new Date().toISOString()
    };
    
    await fs.writeFile(
      path.join(RESULTS_DIR, 'stats.json'),
      JSON.stringify(stats, null, 2)
    );
    
    console.log('\n📊 Статистика обработки:');
    console.log(`- Обработано файлов: ${files.length}`);
    console.log(`- Всего результатов: ${allResults.length}`);
    console.log(`- После фильтрации: ${filteredResults.length}`);
    console.log(`- Уникальных доменов: ${uniqueResults.length}`);
    
    return uniqueResults.length;
  } catch (error) {
    console.error('❌ Ошибка при обработке результатов:', error.message);
    return 0;
  }
}

// Запускаем скрипт, если он запущен непосредственно
if (require.main === module) {
  processResults().catch(console.error);
}

module.exports = { processResults };
