'use client';

import { Header, Footer } from '@/components/Header';
import { SkillInstallCard } from '@/components/SkillInstallCard';
import { useEmbeddedBankr } from '@/components/EmbeddedBankrProvider';

export default function SkillPage() {
  const embed = useEmbeddedBankr();

  return (
    <div className={`max-w-[720px] mx-auto px-5 pb-16 ${embed.isEmbedded ? 'pt-4' : ''}`}>
      <Header backHref="/" />
      <SkillInstallCard />
      <Footer />
    </div>
  );
}
