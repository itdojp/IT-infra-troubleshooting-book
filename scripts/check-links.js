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
      // 注: 行内の文字数を維持し、壊れたリンク報告時の `column` がズレないようにする
      const scrubbedLine = line.replace(/`[^`]*`/g, match => ' '.repeat(match.length));

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
    const { url } = link;
    
    // 外部URLはスキップ（オプションで検証可能）
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return { valid: true, type: 'external' };
    }
    
    // メールリンクはスキップ
    if (url.startsWith('mailto:')) {
      return { valid: true, type: 'email' };
    }
    
    // 相対パスの解決
    const sourceDir = path.dirname(sourceFile);
    let targetPath;
    
    if (url.startsWith('/')) {
      // 絶対パス（プロジェクトルートから）
      targetPath = path.join(baseDir, url);
    } else {
      // 相対パス
      targetPath = path.resolve(sourceDir, url);
    }

    // アンカーの処理
    let anchor = null;
    if (targetPath.includes('#')) {
      const parts = targetPath.split('#');
      targetPath = parts[0];
      anchor = parts[1];
    }

    // Jekyll の docs/ 配下をサイトルートにしている構成のため、
    // "/src/..." のようなサイト内パスを docs/ に寄せて解決する（存在しない場合のみ）。
    const urlBaseLooksLikeDocsRoot = url.startsWith('/') && !targetPath.startsWith(path.join(baseDir, 'docs'));
    if (urlBaseLooksLikeDocsRoot && !(await fs.pathExists(targetPath))) {
      const docsRoot = path.join(baseDir, 'docs');
      if (await fs.pathExists(docsRoot)) {
        const docsTarget = path.join(docsRoot, url);
        if (await fs.pathExists(docsTarget)) {
          targetPath = docsTarget;
        } else {
          // docs/ 配下に相当するパスが無い場合でも、後段の候補探索で拾える可能性があるため
          // targetPath 自体はそのまま維持する。
        }
      }
    }

    // ファイルの存在確認
    try {
      // 候補の優先順位に従って最初に存在したものを採用する:
      // 1) 明示的に指定されたパス（拡張子付きの場合）
      // 2) 拡張子が省略されていた場合の "<path>.md"
      // 3) "<path>/index.md"
      // 4) "<path>/index.html"
      const candidates = [];
      candidates.push(targetPath);

      const trimmed = targetPath.replace(/[\\\/]+$/, '');
      const hasExt = path.extname(trimmed) !== '';

      // 末尾 "/" の pretty URL (例: ../appendices/a/) を ../appendices/a.md として解決する
      if (trimmed !== targetPath) {
        candidates.push(trimmed);
      }
      if (!hasExt) {
        candidates.push(`${trimmed}.md`);
      }
      candidates.push(path.join(trimmed, 'index.md'));
      candidates.push(path.join(trimmed, 'index.html'));

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
      targetPath = existing[0];
      
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
