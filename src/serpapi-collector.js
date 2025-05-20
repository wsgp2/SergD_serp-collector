/**
 * Скрипт для сбора данных из поисковой выдачи с использованием SerpAPI
 * Оптимизирован для получения максимального количества результатов
 * с минимальным количеством запросов
 */

const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const { existsSync, mkdirSync } = require('fs');
require('dotenv').config();

// Путь к директории с результатами
const RESULTS_DIR = path.join(__dirname, '../data/results');

// API ключ
const API_KEY = process.env.SERPAPI_KEY || 'fb6ea3b4855525a901510ce4462e10c39cfd2a17798c1f34e100500f3cc710eb';

// Функция задержки
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Выполняет запрос к SerpAPI
 * @param {string} keyword - Ключевое слово для поиска
 * @param {object} options - Дополнительные параметры
 * @returns {Promise<Object>} - Результат запроса
 */
async function searchSerpApi(keyword, options = {}) {
  try {
    console.log(`🔍 Запрос к SerpAPI: "${keyword}" (страница ${options.page || 1})`);
    
    // Базовая URL
    const baseUrl = 'https://serpapi.com/search.json';
    
    // Параметры запроса
    const params = {
      q: keyword,
      api_key: API_KEY,
      engine: 'google',
      hl: 'ru',
      gl: 'ru',
      location: 'Russia',
      google_domain: 'google.ru',
      num: options.num || 100,
      start: options.start || 0
    };
    
    // Формируем URL с параметрами
    const url = new URL(baseUrl);
    Object.keys(params).forEach(key => {
      url.searchParams.append(key, params[key]);
    });
    
    // Выполняем запрос
    const response = await axios.get(url.toString());
    
    // Проверяем наличие органических результатов
    if (response.data && response.data.organic_results) {
      console.log(`✅ Получено ${response.data.organic_results.length} результатов`);
      return response.data;
    }
    
    console.warn('⚠️ Нет органических результатов в ответе API');
    return null;
  } catch (error) {
    console.error(`❌ Ошибка запроса к SerpAPI:`, error.message);
    return null;
  }
}

/**
 * Извлекает органические результаты из ответа API
 * @param {Object} response - Ответ API
 * @param {string} keyword - Ключевое слово (для отладки)
 * @returns {Array} - Обработанные результаты
 */
function extractOrganicResults(response, keyword) {
  if (!response || !response.organic_results || !Array.isArray(response.organic_results)) {
    console.warn(`⚠️ Нет органических результатов для "${keyword}"`);
    return [];
  }
  
  return response.organic_results.map(item => {
    // Извлекаем домен из URL
    let domain = 'unknown';
    try {
      domain = new URL(item.link).hostname;
    } catch (e) {
      // Если не получается извлечь домен, используем значение по умолчанию
    }
    
    return {
      title: item.title || '',
      url: item.link || '',
      domain: domain,
      snippet: item.snippet || '',
      position: item.position || 0,
      source: 'google',
      query: keyword
    };
  });
}

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
    'vsetarify.com',
    'mainfin.ru',
    'brobank.ru',
    'rfinansist.ru',
    
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
    'ubrr.ru',
    'tochka.com',
    'business.yandex',
    'blog.domclick.ru',
    'bki-okb.ru',
    'kontur.ru',
    'finlab.ru',
    'bank',
    '.bank',
    'vtbbizсred',
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
 * Загружает ключевые слова из файла
 * @returns {Promise<Array>} - Массив с ключевыми словами
 */
async function loadKeywords() {
  try {
    const keywordsPath = path.join(__dirname, '../data/keywords.json');
    const data = await fs.readFile(keywordsPath, 'utf8');
    const keywords = JSON.parse(data);
    console.log(`✅ Загружено ${keywords.length} ключевых слов`);
    return keywords;
  } catch (error) {
    console.error('❌ Ошибка при загрузке ключевых слов:', error.message);
    // Возвращаем минимальный набор ключевых слов при ошибке
    return ['кредит для ИП', 'кредитование малого бизнеса', 'займ для ООО'];
  }
}

/**
 * Основная функция для запуска сбора данных
 */
async function run() {
  console.log('🚀 Запуск сбора данных через SerpAPI...');
  
  // Создаем директорию для результатов, если она не существует
  if (!existsSync(RESULTS_DIR)) {
    mkdirSync(RESULTS_DIR, { recursive: true });
  }
  
  // Создаем директорию для результатов с трафиком, если она не существует
  const trafficDir = path.join(RESULTS_DIR, 'traffic');
  if (!existsSync(trafficDir)) {
    mkdirSync(trafficDir, { recursive: true });
  }
  
  // Загружаем ключевые слова
  const keywords = await loadKeywords();
  
  // Ограничение запросов - сколько ключевых слов обрабатывать
  // Учитывая лимит в 100 бесплатных запросов
  const keywordsLimit = Math.min(keywords.length, 15);
  
  console.log(`ℹ️ Будет обработано ${keywordsLimit} из ${keywords.length} ключевых слов`);
  
  let allResults = [];
  let requestCount = 0;
  
  // Обрабатываем каждое ключевое слово
  for (let i = 0; i < keywordsLimit; i++) {
    const keyword = keywords[i];
    console.log(`\n🔍 Обработка ключевого слова ${i+1}/${keywordsLimit}: "${keyword}"`);
    
    try {
      // Запрашиваем первые 100 результатов
      requestCount++;
      const response = await searchSerpApi(keyword, { num: 100 });
      
      if (response) {
        // Извлекаем органические результаты
        const results = extractOrganicResults(response, keyword);
        
        // Сохраняем промежуточные результаты
        const filteredResults = filterAggregatorsAndBanks(results);
        await fs.writeFile(
          path.join(RESULTS_DIR, `serpapi_${keyword.replace(/\s+/g, '_')}.json`),
          JSON.stringify(filteredResults, null, 2)
        );
        
        console.log(`✅ Найдено ${results.length} результатов, после фильтрации: ${filteredResults.length}`);
        
        // Добавляем результаты в общий массив
        allResults = [...allResults, ...filteredResults];
      }
      
      // Задержка между запросами (чтобы не превысить лимит API)
      if (i < keywordsLimit - 1) {
        const waitTime = 1000 + Math.random() * 2000;
        console.log(`⏱️ Ожидание ${Math.round(waitTime/1000)} секунд перед следующим запросом...`);
        await delay(waitTime);
      }
    } catch (error) {
      console.error(`❌ Ошибка при обработке "${keyword}":`, error.message);
    }
  }
  
  // Удаляем дубликаты и фильтруем агрегаторы и банки
  console.log('\n🔧 Обработка всех результатов...');
  const filteredResults = filterAggregatorsAndBanks(allResults);
  const uniqueResults = removeDuplicateDomains(filteredResults);
  console.log(`✅ Найдено ${filteredResults.length} результатов после фильтрации`);
  console.log(`✅ После удаления дубликатов: ${uniqueResults.length} уникальных доменов`);
  
  // Сохраняем итоговый результат
  const finalResultsPath = path.join(RESULTS_DIR, 'final_results.json');
  await fs.writeFile(finalResultsPath, JSON.stringify(uniqueResults, null, 2));
  console.log(`💾 Финальные результаты сохранены в ${finalResultsPath}`);
  
  // Создаем CSV файл для системы перехвата
  await createCsvForIntercept(uniqueResults);
  
  // Сохраняем статистику
  const stats = {
    totalKeywords: keywords.length,
    processedKeywords: keywordsLimit,
    totalRequests: requestCount,
    totalResults: allResults.length,
    uniqueResults: uniqueResults.length,
    collectionDate: new Date().toISOString()
  };
  
  await fs.writeFile(
    path.join(RESULTS_DIR, 'stats.json'),
    JSON.stringify(stats, null, 2)
  );
  
  console.log(`\n📊 Статистика сбора данных:`);
  console.log(`- Обработано ключевых слов: ${keywordsLimit}/${keywords.length}`);
  console.log(`- Выполнено API-запросов: ${requestCount}`);
  console.log(`- Всего результатов: ${allResults.length}`);
  console.log(`- Уникальных доменов: ${uniqueResults.length}`);
  
  return stats;
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

// Запускаем скрипт, если он запущен непосредственно
if (require.main === module) {
  run().catch(console.error);
}

module.exports = { run };
