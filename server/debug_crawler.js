// 디버깅용 크롤러 스크립트
import * as cheerio from 'cheerio';

const MALL_ID = 'cheritale25';

async function fetchPage(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
    },
  });
  return response.text();
}

async function debug() {
  console.log('=== Cafe24 크롤링 디버깅 시작 ===\n');

  // 메인 페이지에서 카테고리 찾기
  const mainHtml = await fetchPage(`https://${MALL_ID}.cafe24.com`);
  const $main = cheerio.load(mainHtml);

  // 카테고리 링크 찾기
  const categoryLinks = [];
  $main('a[href*="/product/list.html?cate_no="]').each((_, el) => {
    const href = $main(el).attr('href');
    const text = $main(el).text().trim();
    if (text && href) {
      categoryLinks.push({ text, href });
    }
  });

  console.log('발견된 카테고리 링크:');
  categoryLinks.slice(0, 10).forEach(c => console.log(`  - ${c.text}: ${c.href}`));
  console.log('');

  // 첫 번째 카테고리 페이지 분석
  if (categoryLinks.length > 0) {
    const firstCat = categoryLinks[0];
    const catUrl = firstCat.href.startsWith('http') ? firstCat.href : `https://${MALL_ID}.cafe24.com${firstCat.href}`;

    console.log(`\n=== 카테고리 페이지 분석: ${firstCat.text} ===`);
    console.log(`URL: ${catUrl}\n`);

    const catHtml = await fetchPage(catUrl);
    const $ = cheerio.load(catHtml);

    // 상품 목록 셀렉터 테스트
    const selectors = [
      'ul.prdList > li',
      '.prdList > li',
      '.prdList li.xans-record-',
      '.prdList li',
      'li.xans-record-',
      '[class*="prdList"] li',
    ];

    console.log('셀렉터 테스트:');
    for (const sel of selectors) {
      const count = $(sel).length;
      console.log(`  ${sel}: ${count}개`);
    }

    // 실제 상품 li 요소 분석
    const productLis = $('ul.prdList li, .prdList li').filter(function() {
      return $(this).find('a[href*="product"]').length > 0;
    });

    console.log(`\n상품 li 요소: ${productLis.length}개\n`);

    if (productLis.length > 0) {
      console.log('=== 첫 번째 상품 상세 분석 ===\n');
      const $first = $(productLis[0]);

      // 상품 링크
      const link = $first.find('a[href*="product"]').first().attr('href');
      console.log('상품 링크:', link);

      // ID 추출 테스트
      const patterns = [
        /\/product\/[^/]+\/(\d+)/,
        /product_no=(\d+)/,
        /\/(\d+)/,
      ];

      for (const pat of patterns) {
        const match = link?.match(pat);
        if (match) {
          console.log(`ID 추출 (${pat}):`, match[1]);
        }
      }

      // 이미지 분석
      console.log('\n--- 이미지 분석 ---');
      const prdImg = $first.find('.prdImg img').first();
      console.log('.prdImg img src:', prdImg.attr('src'));
      console.log('.prdImg img alt:', prdImg.attr('alt'));
      console.log('.prdImg img data-src:', prdImg.attr('data-src'));

      // 상품명 분석
      console.log('\n--- 상품명 분석 ---');
      const nameDiv = $first.find('.name');
      console.log('.name 존재:', nameDiv.length > 0);

      if (nameDiv.length > 0) {
        console.log('.name HTML:', nameDiv.html()?.substring(0, 500));

        const spans = nameDiv.find('span');
        console.log(`\nspan 개수: ${spans.length}`);
        spans.each((i, span) => {
          const $span = $(span);
          console.log(`  span[${i}]: class="${$span.attr('class')}" text="${$span.text().trim().substring(0, 50)}"`);
        });

        // displaynone이 아닌 span 찾기
        const visibleSpans = nameDiv.find('span').filter(function() {
          const className = $(this).attr('class') || '';
          return !className.includes('displaynone') && !className.includes('title');
        });
        console.log(`\nvisible span 개수: ${visibleSpans.length}`);
        visibleSpans.each((i, span) => {
          console.log(`  visible span[${i}]: "${$(span).text().trim()}"`);
        });
      }

      // 가격 분석
      console.log('\n--- 가격 분석 ---');
      const priceEl = $first.find('.price, [class*="price"]').first();
      console.log('가격 요소 텍스트:', priceEl.text().trim());

      // li 전체 구조 출력
      console.log('\n--- li 전체 HTML (첫 1000자) ---');
      console.log($first.html()?.substring(0, 1000));
    }
  }

  // 전체 상품 목록 페이지도 확인
  console.log('\n\n=== 전체 상품 페이지 확인 ===');
  const allProductsUrl = `https://${MALL_ID}.cafe24.com/product/list.html`;
  try {
    const allHtml = await fetchPage(allProductsUrl);
    const $all = cheerio.load(allHtml);

    const allProducts = $all('ul.prdList li, .prdList li').filter(function() {
      return $all(this).find('a[href*="product"]').length > 0;
    });
    console.log(`전체 상품 페이지 상품 수: ${allProducts.length}`);
  } catch (e) {
    console.log('전체 상품 페이지 접근 실패:', e.message);
  }
}

debug().catch(console.error);
