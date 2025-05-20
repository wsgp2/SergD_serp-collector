/**
 * Основной индексный файл проекта
 * Точка входа для запуска скриптов
 */

const serpapiCollector = require('./serpapi-collector');
const processResults = require('./process-results');

async function main() {
  // Получаем аргументы командной строки
  const args = process.argv.slice(2);
  const mode = args[0] || 'process';

  try {
    if (mode === 'collect') {
      // Запускаем сборщик данных с SerpAPI
      console.log('🔍 Запуск сбора данных из SerpAPI...\n');
      await serpapiCollector.run();
    } else if (mode === 'process') {
      // Запускаем обработку существующих результатов
      console.log('⚙️ Запуск обработки существующих данных...\n');
      await processResults.processResults();
    } else {
      console.error('⛔ Неизвестный режим работы. Используйте "collect" или "process"');
    }
  } catch (error) {
    console.error('❌ Произошла ошибка:', error);
    process.exit(1);
  }
}

// Запускаем основную функцию
main().catch(console.error);
