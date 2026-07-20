#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export class NetworkConfigContractError extends Error {}

const appendixPaths = {
  manuscript: 'manuscript/appendices/c.md',
  docs: 'docs/appendices/c.md',
};

const synchronizedSections = [
  {
    name: 'RHEL 9 NetworkManager primary procedure',
    start: '#### NetworkManager/keyfile 設定例（RHEL 9の主手順）',
    end: '#### Legacy: ifcfg-*（RHEL 8 / RHEL 9既存環境の移行対象）',
  },
  {
    name: 'RHEL ifcfg legacy migration boundary',
    start: '#### Legacy: ifcfg-*（RHEL 8 / RHEL 9既存環境の移行対象）',
    end: '### Ubuntu/Debian ネットワーク設定',
  },
  {
    name: 'Netplan default route procedure',
    start: '#### /etc/netplan/*.yaml の例（Ubuntu / Netplan）',
    end: '#### /etc/network/interfaces (Debian/Ubuntu classic)',
  },
  {
    name: 'RHEL 9 static route procedure',
    start: '#### RHEL 9 / NetworkManager（nmcli）',
    end: '#### /etc/network/interfaces でのルート設定 (Debian/Ubuntu)',
  },
];

const requiredMarkers = [
  'RHEL 9 では NetworkManager が標準',
  '既定保存形式は keyfile',
  '/etc/NetworkManager/system-connections/*.nmconnection',
  'nmcli connection add',
  'RFC 5737の文書用アドレス',
  'nmcli -f TYPE,FILENAME,NAME connection show',
  'RHEL 9でdeprecated',
  'NM_CONTROLLED=no',
  'nmcli connection migrate "<connection-name-or-UUID>"',
  'source ifcfg profileをkeyfileへ置換',
  'backup内の該当ifcfg fileを元のpathへ復元',
  'routes:',
  '- to: default',
  'via: 192.0.2.1',
  'sudo netplan generate',
  'sudo netplan try',
  'netplan status enp1s0',
  '+ipv4.routes',
  'https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/9/html/configuring_and_managing_networking/configuring-an-ethernet-connection_configuring-and-managing-networking',
  'https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/9/html/configuring_and_managing_networking/assembly_networkmanager-connection-profiles-in-keyfile-format_configuring-and-managing-networking',
  'https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/9/html/configuring_and_managing_networking/configuring-static-routes_configuring-and-managing-networking',
  'https://netplan.readthedocs.io/en/stable/netplan-yaml/',
];

const forbiddenPatterns = [
  {
    pattern: /^\s*gateway[46]:/m,
    message: 'deprecated gateway4/gateway6 key must not appear in the current Netplan example',
  },
  {
    pattern: /^#### \/etc\/sysconfig\/network-scripts\/ifcfg-/m,
    message: 'ifcfg must not be presented as an unlabeled current procedure',
  },
  {
    pattern: /^#### \/etc\/sysconfig\/network-scripts\/route-/m,
    message: 'route-* must not be presented as the current RHEL 9 route procedure',
  },
];

function readRequired(root, relativePath) {
  try {
    return fs.readFileSync(path.join(root, relativePath), 'utf8');
  } catch (error) {
    throw new NetworkConfigContractError(
      `network config contract could not read ${relativePath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function extractSection(text, section, label) {
  const start = text.indexOf(section.start);
  if (start < 0) {
    throw new NetworkConfigContractError(`${label} is missing ${section.name} start marker`);
  }
  const end = text.indexOf(section.end, start + section.start.length);
  if (end < 0) {
    throw new NetworkConfigContractError(`${label} is missing ${section.name} end marker`);
  }
  return text.slice(start, end).trim();
}

export function validateNetworkConfigTexts(manuscript, docs) {
  for (const [label, text] of Object.entries({ manuscript, docs })) {
    for (const { pattern, message } of forbiddenPatterns) {
      if (pattern.test(text)) {
        throw new NetworkConfigContractError(`${label} appendix C: ${message}`);
      }
    }
    for (const marker of requiredMarkers) {
      if (!text.includes(marker)) {
        throw new NetworkConfigContractError(`${label} appendix C is missing required marker ${JSON.stringify(marker)}`);
      }
    }
  }

  for (const section of synchronizedSections) {
    const sourceSection = extractSection(manuscript, section, 'manuscript');
    const publicSection = extractSection(docs, section, 'docs');
    if (sourceSection !== publicSection) {
      throw new NetworkConfigContractError(
        `${section.name} differs between manuscript/appendices/c.md and docs/appendices/c.md`,
      );
    }
  }

  return { synchronizedSectionCount: synchronizedSections.length };
}

export function validateNetworkConfigModernization(
  root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'),
) {
  const manuscript = readRequired(root, appendixPaths.manuscript);
  const docs = readRequired(root, appendixPaths.docs);
  return validateNetworkConfigTexts(manuscript, docs);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = validateNetworkConfigModernization();
    console.log(
      `OK: RHEL 9 and Netplan procedures are current and synchronized (${result.synchronizedSectionCount} sections)`,
    );
  } catch (error) {
    console.error(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
