#!/usr/bin/env node

import fs from 'fs-extra';
import path from 'path';
import { glob } from 'glob';
import chalk from 'chalk';
import { Command } from 'commander';

/**
 * リンクチェッカーツール
 * Markdownファイル内のリンクを検証
 */
class LinkChecker {
  constructor() {
    this.brokenLinks = [];
    this.checkedLinks = new Set();
    this.fileLinks = new Map(); // ファイルごとのリンクを記録
  }

  /**
   * コードブロック（fenced code block）内かどうかを判定しながらリンク抽出するための簡易トグル
   * @param {string} line
   * @returns {string|null} fence marker (例: "```", "````", "~~~") もしくは null
   */
  detectFenceMarker(line) {
    const match = line.match(/^\s*(```+|~~~+)/);
    if (!match) return null;
    return match[1];
  }

  /**
   * ディレクトリ内のMarkdownファイルをチェック
   * @param {string} directory - チェック対象のディレクトリ
   * @param {Object} options - オプション
   */
  async checkDirectory(directory, options = {}) {
    const {
      pattern = '**/*.md',
      ignore = ['node_modules/**', '**/node_modules/**', 'output/**', '**/output/**']
    } = options;
    
    console.log(chalk.blue(`🔍 Checking links in ${directory}...`));
    
    // Markdownファイルを検索
    const files = await glob(path.join(directory, pattern), {
      ignore,
      windowsPathsNoEscape: true
    });
    
    console.log(chalk.gray(`Found ${files.length} markdown files`));
    
    // 各ファイルをチェック
    for (const file of files) {
      await this.checkFile(file, directory);
    }
    
    return this.generateReport();
  }

  /**
   * 単一ファイルのリンクをチェック
   * @param {string} filePath - ファイルパス
   * @param {string} baseDir - ベースディレクトリ
   */
  async checkFile(filePath, baseDir) {
    const content = await fs.readFile(filePath, 'utf8');
    const relativeFile = path.relative(baseDir, filePath);
    
    // Markdownリンクを抽出
    const links = this.extractLinks(content);
    
    if (links.length === 0) return;
    
    console.log(chalk.gray(`  Checking ${relativeFile} (${links.length} links)`));
    
    this.fileLinks.set(relativeFile, []);
    
    for (const link of links) {
      const result = await this.validateLink(link, filePath, baseDir);
      
      this.fileLinks.get(relativeFile).push({
        ...link,
        ...result
      });
      
      if (!result.valid) {
        this.brokenLinks.push({
          file: relativeFile,
          line: link.line,
          column: link.column,
          url: link.url,
          text: link.text,
          reason: result.reason
        });
      }
    }
  }

  /**
   * Markdownコンテンツからリンクを抽出
   * @param {string} content - Markdownコンテンツ
   * @returns {Array} リンク情報の配列
   */
  extractLinks(content) {
    const links = [];
    const lines = content.split('\n');

    // fenced code block 内の誤検知（例: Python の dict/配列アクセス）を避ける
    let inFence = false;
    let fenceMarker = null;
    
    // リンクパターン
    const patterns = [
      // [text](url)
      /\[([^\]]+)\]\(([^)]+)\)/g,
      // [text][ref] style references
      /\[([^\]]+)\]\[([^\]]+)\]/g,
      // 参照定義 [ref]: url
      /^\s*\[([^\]]+)\]:\s*(.+)$/gm
    ];
    
    lines.forEach((line, lineIndex) => {
      const marker = this.detectFenceMarker(line);
      if (marker) {
        if (!inFence) {
          inFence = true;
          fenceMarker = marker;
        } else if (fenceMarker && marker[0] === fenceMarker[0] && marker.length >= fenceMarker.length) {
          inFence = false;
          fenceMarker = null;
        }
      }
      if (inFence) return;

      // インラインコード内の誤検知も避ける
      // 注: 行内の文字数を維持し、壊れたリンク報告時の `column` がズレないようにする。
      // Markdown のコードスパンはバッククォート数が可変なため、`+ ... \1` で対にする。
      const scrubbedLine = line.replace(/(`+)[\s\S]*?\1/g, match => ' '.repeat(match.length));

      patterns.forEach(pattern => {
        pattern.lastIndex = 0;
        let match;
        while ((match = pattern.exec(scrubbedLine)) !== null) {
          const text = match[1];
          const url = match[2] || '';
          
          // URLでないものはスキップ
          if (!url || url.startsWith('#')) continue;
          
          links.push({
            line: lineIndex + 1,
            column: match.index + 1,
            text: text.trim(),
            url: url.trim(),
            raw: match[0]
          });
        }
      });
    });
    
    return links;
  }

  /**
   * リンクを検証
   * @param {Object} link - リンク情報
   * @param {string} sourceFile - ソースファイルパス
   * @param {string} baseDir - ベースディレクトリ
   * @returns {Object} 検証結果
   */
  async validateLink(link, sourceFile, baseDir) {
    const { url: urlRaw } = link;
    
    // 外部URLはスキップ（オプションで検証可能）
    if (urlRaw.startsWith('http://') || urlRaw.startsWith('https://')) {
      return { valid: true, type: 'external' };
    }
    
    // メールリンクはスキップ
    if (urlRaw.startsWith('mailto:')) {
      return { valid: true, type: 'email' };
    }

    // アンカーの処理（URL文字列から先に分離する）
    let urlPath = urlRaw;
    let anchor = null;
    const hashIndex = urlRaw.indexOf('#');
    if (hashIndex !== -1) {
      urlPath = urlRaw.slice(0, hashIndex);
      anchor = urlRaw.slice(hashIndex + 1);
    }

    // パスの解決（absolute: docs/ ルート or リポジトリルート、relative: sourceFile 相対）
    const sourceDir = path.dirname(sourceFile);
    const docsRoot = path.join(baseDir, 'docs');
    const docsExists = await fs.pathExists(docsRoot);
    const candidateRoots = [];

    if (urlPath.startsWith('/')) {
      // 先頭の "/" を落として結合しないと、path.join がルート扱いして baseDir を無視してしまう
      const urlRelative = urlPath.replace(/^\/+/, '');
      const fromRepoRoot = path.join(baseDir, urlRelative);
      const fromDocsRoot = path.join(docsRoot, urlRelative);

      // docs 配下の Markdown からの参照は「サイト内リンク（docs/ ルート）」であることが多いため優先する
      const isUnderDocsRoot = docsExists
        ? (() => {
            const relative = path.relative(docsRoot, sourceFile);
            return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
          })()
        : false;

      if (docsExists && isUnderDocsRoot) {
        candidateRoots.push(fromDocsRoot, fromRepoRoot);
      } else {
        candidateRoots.push(fromRepoRoot);
        if (docsExists) candidateRoots.push(fromDocsRoot);
      }
    } else {
      candidateRoots.push(path.resolve(sourceDir, urlPath));
    }

    // ファイルの存在確認
    try {
      // 候補の優先順位に従って最初に存在したものを採用する:
      // - ルート候補（docs ルート / リポジトリルート / 相対パス解決）の順に探索する
      // - 各ルート候補の中では、次の順に解決する
      //   1) 明示的に指定されたパス（拡張子付きの場合）
      //   2) 拡張子が省略されていた場合の "<path>.md"
      //   3) "<path>/index.md"
      //   4) "<path>/index.html"
      const candidates = [];
      const seen = new Set();

      for (const root of candidateRoots) {
        if (!root) continue;

        const trimmed = root.replace(/[\\\/]+$/, '');
        const hasExt = path.extname(trimmed) !== '';

        const localCandidates = [root];
        if (trimmed !== root) localCandidates.push(trimmed);
        if (!hasExt) localCandidates.push(`${trimmed}.md`);
        localCandidates.push(path.join(trimmed, 'index.md'));
        localCandidates.push(path.join(trimmed, 'index.html'));

        for (const candidate of localCandidates) {
          if (!candidate) continue;
          if (seen.has(candidate)) continue;
          seen.add(candidate);
          candidates.push(candidate);
        }
      }

      const existing = [];
      for (const candidate of candidates) {
        if (!candidate) continue;
        if (await fs.pathExists(candidate)) {
          existing.push(candidate);
        }
      }

      if (existing.length === 0) {
        return {
          valid: false,
          reason: 'File not found',
          type: 'internal'
        };
      }

      // 最初に存在したものを採用
      const targetPath = existing[0];
      
      // アンカーの検証（オプション）
      if (anchor) {
        const valid = await this.validateAnchor(targetPath, anchor);
        if (!valid) {
          return {
            valid: false,
            reason: `Anchor #${anchor} not found`,
            type: 'anchor'
          };
        }
      }
      
      return { valid: true, type: 'internal' };
      
    } catch (error) {
      return { 
        valid: false, 
        reason: error.message,
        type: 'error'
      };
    }
  }

  /**
   * アンカーの存在を検証
   * @param {string} filePath - ファイルパス
   * @param {string} anchor - アンカー名
   * @returns {boolean} アンカーが存在するか
   */
  async validateAnchor(filePath, anchor) {
    if (!filePath.endsWith('.md')) return true; // Markdownファイル以外はスキップ
    
    const content = await fs.readFile(filePath, 'utf8');
    
    // ヘッダーからアンカーを生成
    const headers = content.match(/^#{1,6}\s+(.+)$/gm) || [];
    const anchors = headers.map(header => {
      const text = header.replace(/^#{1,6}\s+/, '');
      // GitHubスタイルのアンカー生成
      return text
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-');
    });
    
    return anchors.includes(anchor.toLowerCase());
  }

  /**
   * レポートを生成
   * @returns {Object} レポート
   */
  generateReport() {
    const totalFiles = this.fileLinks.size;
    const totalLinks = Array.from(this.fileLinks.values())
      .reduce((sum, links) => sum + links.length, 0);
    const brokenCount = this.brokenLinks.length;
    
    const report = {
      summary: {
        totalFiles,
        totalLinks,
        brokenLinks: brokenCount,
        success: brokenCount === 0
      },
      brokenLinks: this.brokenLinks,
      fileDetails: Object.fromEntries(this.fileLinks)
    };
    
    // コンソール出力
    console.log('\n' + chalk.bold('📊 Link Check Summary'));
    console.log(chalk.gray('─'.repeat(40)));
    console.log(`Total files checked: ${totalFiles}`);
    console.log(`Total links found: ${totalLinks}`);
    
    if (brokenCount === 0) {
      console.log(chalk.green(`✅ All links are valid!`));
    } else {
      console.log(chalk.red(`❌ Found ${brokenCount} broken links:`));
      console.log();
      
      this.brokenLinks.forEach(broken => {
        console.log(chalk.red(`  ${broken.file}:${broken.line}:${broken.column}`));
        console.log(chalk.gray(`    Link: [${broken.text}](${broken.url})`));
        console.log(chalk.yellow(`    Reason: ${broken.reason}`));
        console.log();
      });
    }
    
    return report;
  }

  /**
   * レポートをファイルに保存
   * @param {Object} report - レポート
   * @param {string} outputPath - 出力パス
   */
  async saveReport(report, outputPath) {
    await fs.writeFile(
      outputPath,
      JSON.stringify(report, null, 2),
      'utf8'
    );
    console.log(chalk.blue(`\n📄 Report saved to: ${outputPath}`));
  }
}

// CLIの設定
const program = new Command();

program
  .name('check-links')
  .description('Check for broken links in markdown files')
  .version('1.0.0')
  .argument('[directory]', 'Directory to check', '.')
  .option('-p, --pattern <pattern>', 'Glob pattern for files', '**/*.md')
  .option('-i, --ignore <patterns...>', 'Patterns to ignore', ['node_modules/**', '**/node_modules/**', 'output/**', '**/output/**'])
  .option('-o, --output <file>', 'Save report to file')
  .option('-e, --external', 'Also check external URLs (slower)')
  .action(async (directory, options) => {
    const checker = new LinkChecker();
    
    try {
      const report = await checker.checkDirectory(directory, {
        pattern: options.pattern,
        ignore: options.ignore,
        checkExternal: options.external
      });
      
      if (options.output) {
        await checker.saveReport(report, options.output);
      }
      
      // 終了コード
      process.exit(report.summary.success ? 0 : 1);
      
    } catch (error) {
      console.error(chalk.red(`❌ Error: ${error.message}`));
      process.exit(1);
    }
  });

program.parse();

export { LinkChecker };
