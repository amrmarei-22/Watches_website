import { useEffect, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { businessConfig } from '../config/businessConfig'
import { isContentPresent, parseMarkdown, type MarkdownBlock } from '../content/staticPage'
import type { i18nLanguage } from '../lib/i18n'

const pageContent = import.meta.glob('../content/pages/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

type StaticPageSlug = 'contact' | 'shipping' | 'privacy' | 'terms'

function InlineMarkdown({ text }: { text: string }) {
  const parts = text.split(/(\[[^\]]+\]\([^)]+\))/g)
  return <>{parts.map((part, index) => {
    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part)
    return link ? <a key={index} href={link[2]}>{link[1]}</a> : <span key={index}>{part}</span>
  })}</>
}

function MarkdownContent({ blocks }: { blocks: MarkdownBlock[] }) {
  return <>{blocks.map((block, index) => {
    if (block.type === 'heading') {
      const Heading = `h${block.level}` as 'h1' | 'h2' | 'h3'
      return <Heading key={index}><InlineMarkdown text={block.text} /></Heading>
    }
    if (block.type === 'list') {
      const List = block.ordered ? 'ol' : 'ul'
      return <List key={index}>{block.items.map((item) => <li key={item}><InlineMarkdown text={item} /></li>)}</List>
    }
    return <p key={index}><InlineMarkdown text={block.text} /></p>
  })}</>
}

export function StaticPage({ slug }: { slug: StaticPageSlug }) {
  const { i18n, t } = useTranslation()
  const lang = i18n.language as i18nLanguage
  const markdown = pageContent[`../content/pages/${slug}.${lang}.md`] ?? ''
  const hasContent = isContentPresent(markdown)
  useEffect(() => {
    document.title = t(`pages.${slug}.title`)
    let robots = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]')
    if (!robots) {
      robots = document.createElement('meta')
      robots.name = 'robots'
      document.head.appendChild(robots)
    }
    robots.content = hasContent ? 'index,follow' : 'noindex'
    return () => {
      if (robots?.content === 'noindex') robots.remove()
    }
  }, [hasContent, slug, t])
  const contactItems = [
    businessConfig.contact.whatsapp ? <a key="whatsapp" href={`https://wa.me/${businessConfig.contact.whatsapp}`}>{t('footer.whatsapp')}: {businessConfig.contact.whatsapp}</a> : null,
    businessConfig.contact.phone ? <a key="phone" href={`tel:${businessConfig.contact.phone}`}>{t('footer.phone')}: {businessConfig.contact.phone}</a> : null,
    businessConfig.contact.email ? <a key="email" href={`mailto:${businessConfig.contact.email}`}>{t('footer.email')}: {businessConfig.contact.email}</a> : null,
    (lang === 'ar' ? businessConfig.contact.hoursAr : businessConfig.contact.hoursEn) ? <span key="hours">{t('footer.hours')}: {lang === 'ar' ? businessConfig.contact.hoursAr : businessConfig.contact.hoursEn}</span> : null,
    businessConfig.contact.instagram ? <a key="instagram" href={businessConfig.contact.instagram}>{t('footer.instagram')}</a> : null,
    businessConfig.contact.facebook ? <a key="facebook" href={businessConfig.contact.facebook}>{t('footer.facebook')}</a> : null,
  ].filter((item): item is ReactElement => item !== null)
  return <article className="container static-page"><h1 className="page-heading">{t(`pages.${slug}.title`)}</h1>{hasContent ? <MarkdownContent blocks={parseMarkdown(markdown)} /> : <p className="static-page-pending">{t('pages.contentPending')}</p>}{slug === 'contact' && contactItems.length > 0 && <div className="static-contact">{contactItems}</div>}</article>
}
