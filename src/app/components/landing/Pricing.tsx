import React from 'react';
import { motion } from 'motion/react';
import { Check } from 'lucide-react';
import { clsx } from 'clsx';
import { translations, Language } from './translations';

export const PricingSection = ({ lang }: { lang: Language }) => {
  const t = translations[lang].pricing;

  return (
    <section className="py-24 relative z-10">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-16">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-base font-semibold leading-7 text-cyan-400 tracking-widest uppercase"
          >
            {t.title}
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mt-2 text-4xl font-light tracking-tight text-white sm:text-5xl"
          >
            {t.headline}
          </motion.p>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="mt-4 text-lg text-slate-400 max-w-2xl mx-auto"
          >
            {t.subhead}
          </motion.p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          {t.tiers.map((tier, index) => (
            <motion.div
              key={tier.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ y: -5 }}
              className={clsx(
                'relative flex flex-col justify-between p-6 rounded-3xl border transition-all duration-300',
                index === 2 
                  ? 'bg-cyan-950/40 backdrop-blur-md border-cyan-500/50 shadow-2xl shadow-cyan-900/20' 
                  : 'bg-black/20 backdrop-blur-sm border-white/5 hover:border-white/20'
              )}
            >
              {index === 2 && (
                <div className="absolute -top-4 left-0 right-0 flex justify-center">
                  <span className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full tracking-wider uppercase">
                    Recommended
                  </span>
                </div>
              )}
              
              <div>
                <h3 className="text-lg font-semibold leading-8 text-white">{tier.name}</h3>
                <div className="mt-4 flex items-baseline gap-x-2">
                  <span className="text-3xl font-bold tracking-tight text-white">{tier.price}</span>
                  {tier.price !== 'Custom' && tier.price !== 'Sob Medida' && tier.price !== 'A Medida' && tier.price !== 'Gratuito' && (
                    <span className="text-sm font-semibold leading-6 text-slate-400">{t.frequency}</span>
                  )}
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-400 min-h-[48px]">{tier.description}</p>
                <ul role="list" className="mt-6 space-y-3 text-xs leading-5 text-slate-300">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex gap-x-2 items-start">
                      <Check className="h-4 w-4 flex-none text-cyan-400" aria-hidden="true" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
              <button
                className={clsx(
                  'mt-8 block w-full rounded-md px-3 py-2 text-center text-xs font-bold leading-6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 transition-all uppercase tracking-wide',
                  index === 2
                    ? 'bg-cyan-500 text-white hover:bg-cyan-400 focus-visible:outline-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-[0_0_30px_rgba(6,182,212,0.5)]'
                    : 'bg-white/10 text-white hover:bg-white/20 focus-visible:outline-white'
                )}
              >
                {tier.cta}
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
