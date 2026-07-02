export type PackageKey = 'free' | 'plus' | 'pro' | 'edu';

export type PackageDefinition = {
  key: PackageKey;
  name: string;
  priceCents: number;
  storageLimitBytes: number;
  features: string[];
  requiresUtmVerification?: boolean;
  badge?: string;
};

const GB = 1024 * 1024 * 1024;

export const PACKAGES: PackageDefinition[] = [
  {
    key: 'free',
    name: 'Free',
    priceCents: 0,
    storageLimitBytes: 1 * GB,
    features: [
      '1 GB encrypted storage',
      '25 MB max file upload',
      'AI malware scanning',
      'AES-256-GCM encryption',
      'File sharing with access controls',
      'Audit logging',
    ],
  },
  {
    key: 'edu',
    name: 'Student (Edu)',
    priceCents: 0,
    storageLimitBytes: 25 * GB,
    requiresUtmVerification: true,
    badge: 'UTM Exclusive',
    features: [
      '25 GB encrypted storage',
      '50 MB max file upload',
      'AI malware scanning',
      'AES-256-GCM encryption',
      'File sharing with access controls',
      'Full audit logging',
      'Verified UTM student badge',
      'Requires @utm.my or @graduate.utm.my',
    ],
  },
  {
    key: 'plus',
    name: 'Plus',
    priceCents: 2000,
    storageLimitBytes: 25 * GB,
    features: [
      '25 GB encrypted storage',
      '50 MB max file upload',
      'AI malware scanning',
      'AES-256-GCM encryption',
      'File sharing with access controls',
      'Full audit logging',
      'Priority support',
    ],
  },
  {
    key: 'pro',
    name: 'Pro',
    priceCents: 5000,
    storageLimitBytes: 100 * GB,
    badge: 'Most storage',
    features: [
      '100 GB encrypted storage',
      '100 MB max file upload',
      'AI malware scanning',
      'AES-256-GCM encryption',
      'File sharing with access controls',
      'Full audit logging',
      'Priority support',
      'Advanced analytics',
      'Admin dashboard access',
    ],
  },
];

export function isValidPackageKey(key: string): key is PackageKey {
  return PACKAGES.some((p) => p.key === key);
}

export function getPackage(key: string | null | undefined): PackageDefinition {
  return PACKAGES.find((p) => p.key === key) || PACKAGES[0];
}
