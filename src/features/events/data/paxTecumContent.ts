export interface PaxTecumGalleryItem {
  id: string
  src: string
  category: string
  description: string
  alt: string
  year?: string
  caption?: string
  layoutClass: 'pt-gallery-wide' | 'pt-gallery-tall' | 'pt-gallery-small'
}

export interface PaxTecumMissionItem {
  number: string
  title: string
  description: string
}

/**
 * Centralized official content for the Pax Tecum 2026 public landing page (/pax-tecum).
 * Drop real parish photographs into public/pax-tecum/ using the filenames below.
 * Until actual photos are added, the page renders clearly labeled temporary placeholders.
 */
export const PAX_TECUM_2026 = {
  brand: {
    eventTitle: 'Pax Tecum 2026',
    ministryName: 'Ministry of Altar Servers',
    parishName: 'Sacred Heart of Jesus Parish – Morning Breeze',
    logoSrc: '/favicon/favicon.png'
  },

  hero: {
    eyebrow: 'PAX TECUM 2026 • A CHRISTMAS TRADITION',
    headingLine1: 'Bringing Christ Closer.',
    headingHighlight: 'One Home at a Time.',
    description:
      "This Christmas, the Ministry of Altar Servers continues the cherished tradition of Pax Tecum, bringing the image of the Infant Jesus to families throughout Sacred Heart of Jesus Parish – Morning Breeze. Through prayer, faith, and devotion, we share the joy and peace of Christ's birth with our parish community.",
    primaryCta: 'Register Your Household',
    secondaryCta: 'Discover Pax Tecum',
    image: {
      src: '/pax-tecum/hero-visitation.jpg',
      alt: 'Altar servers carrying the image of the Infant Jesus during a Pax Tecum parish household visitation',
      placeholderLabel: 'Previous Pax Tecum Visitation Photo',
      placeholderHint: 'public/pax-tecum/hero-visitation.jpg'
    }
  },

  about: {
    eyebrow: 'THE HEART OF OUR TRADITION',
    headingLine1: 'More Than a Visit.',
    headingHighlight: 'A Tradition of Faith.',
    paragraphs: [
      'Pax Tecum is a meaningful Christmas tradition that brings the image of the Infant Jesus into the homes of parishioners. Led by the Ministry of Altar Servers, each visitation offers families an opportunity to gather in prayer, express their devotion, and celebrate the true meaning of Christmas.',
      'Beyond the homes we visit, Pax Tecum also reaches individuals along our journey, allowing the wider community to participate in this expression of faith.'
    ],
    quote: 'Every home we visit is an opportunity to share the peace, love, and presence of Christ.',
    ctaLabel: 'Learn About Our Tradition',
    mainImage: {
      src: '/pax-tecum/about-prayer.jpg',
      alt: 'Parish family and altar servers praying together before the image of the Infant Jesus',
      placeholderLabel: 'Family Prayer & Visitation Photo',
      placeholderHint: 'public/pax-tecum/about-prayer.jpg'
    },
    insetImage: {
      src: '/pax-tecum/about-infant-jesus.jpg',
      alt: 'Image of the Infant Jesus venerated during Pax Tecum',
      caption: 'Sacred Heart of Jesus Parish – Morning Breeze',
      placeholderLabel: 'Infant Jesus Devotion Photo',
      placeholderHint: 'public/pax-tecum/about-infant-jesus.jpg'
    }
  },

  memories: {
    eyebrow: 'OUR PAX TECUM JOURNEY',
    headingLine1: 'Moments of Faith.',
    headingHighlight: 'Memories of Grace.',
    description:
      'Every year, Pax Tecum brings meaningful moments of prayer, devotion, and togetherness to our parish community. Take a look back at the memories that continue to inspire this cherished Christmas tradition.',
    items: [
      {
        id: 'journey-of-faith',
        src: '/pax-tecum/memory-1-journey.jpg',
        category: 'A Journey of Faith',
        description: 'Altar servers carrying the Infant Jesus through the parish community.',
        alt: 'Altar servers carrying the Infant Jesus through the parish community during Pax Tecum',
        layoutClass: 'pt-gallery-wide'
      },
      {
        id: 'blessings-at-home',
        src: '/pax-tecum/memory-2-home.jpg',
        category: 'Blessings at Home',
        description: 'Families welcoming the Infant Jesus into their homes.',
        alt: 'Parish family welcoming the image of the Infant Jesus into their home',
        layoutClass: 'pt-gallery-tall'
      },
      {
        id: 'moments-of-prayer',
        src: '/pax-tecum/memory-3-prayer.jpg',
        category: 'Moments of Prayer',
        description: 'Households and altar servers praying together.',
        alt: 'Household members and altar servers praying together during a Pax Tecum visit',
        layoutClass: 'pt-gallery-small'
      },
      {
        id: 'sharing-christs-peace',
        src: '/pax-tecum/memory-4-peace.jpg',
        category: "Sharing Christ's Peace",
        description: 'Parishioners venerating the Infant Jesus.',
        alt: 'Parishioners venerating the image of the Infant Jesus along the visitation route',
        layoutClass: 'pt-gallery-small'
      },
      {
        id: 'serving-with-devotion',
        src: '/pax-tecum/memory-5-devotion.jpg',
        category: 'Serving with Devotion',
        description: 'Ministry members participating in the tradition.',
        alt: 'Ministry of Altar Servers members serving with devotion during Pax Tecum',
        layoutClass: 'pt-gallery-wide'
      }
    ] as PaxTecumGalleryItem[]
  },

  mission: {
    eyebrow: 'THE MISSION WE SHARE',
    headingLine1: 'Every Visit.',
    headingHighlight: 'A Moment of Grace.',
    description:
      'Pax Tecum is rooted in a simple yet meaningful mission: to bring the Infant Jesus closer to the hearts and homes of our parishioners. Through every prayer, every visitation, and every encounter, we seek to share the joy of Christmas and strengthen the bonds of our parish community.',
    featuredImage: {
      src: '/pax-tecum/mission-servers.jpg',
      alt: 'Ministry of Altar Servers participating in Pax Tecum parish visitations',
      caption: 'Ministry of Altar Servers',
      subcaption: 'Serving Sacred Heart of Jesus Parish – Morning Breeze',
      placeholderLabel: 'Altar Servers in Mission Photo',
      placeholderHint: 'public/pax-tecum/mission-servers.jpg'
    },
    items: [
      {
        number: '01',
        title: 'Prayer for Every Family',
        description:
          'We visit registered households to offer prayers and invite families to celebrate the presence of Christ in their homes.'
      },
      {
        number: '02',
        title: 'Keeping the Tradition Alive',
        description:
          'Through the dedication of our altar servers, we continue a cherished parish tradition of Christmas devotion and service.'
      },
      {
        number: '03',
        title: 'Faith Beyond the Church',
        description:
          'Our journey extends throughout the parish community, offering opportunities for individuals to encounter and venerate the Infant Jesus.'
      }
    ] as PaxTecumMissionItem[]
  },

  registration: {
    eyebrow: 'WELCOME THE INFANT JESUS',
    headingLine1: 'Open Your Home.',
    headingHighlight: 'Welcome His Presence.',
    description:
      'Be part of Pax Tecum 2026 by registering your household for a visit from the Ministry of Altar Servers. Together, let us celebrate Christmas through prayer, faith, and devotion.',
    primaryCta: 'Register Your Household',
    secondaryCta: 'View Visitation Details',
    details: [
      { label: 'Visitation Dates', value: 'December 25, 26, 28, and 29, 2026' },
      { label: 'Registration Target', value: 'December 20, 2026' },
      { label: 'Coverage', value: 'Sacred Heart of Jesus Parish – Morning Breeze' },
      { label: 'Registration Fee', value: 'FREE' }
    ],
    scheduleNote:
      'Visitation schedules are subject to route planning and confirmation by the Ministry of Altar Servers.',
    voluntaryNotice:
      'Registration is completely free. Pax Tecum is a religious tradition, not a fundraising activity. Any donation is entirely voluntary and is not required for a household visitation.'
  },

  closing: {
    eyebrow: 'PAX TECUM 2026',
    headingLine1: "Let Christ's Peace",
    headingHighlight: 'Reach Every Home.',
    description:
      'This Christmas, join us in continuing a beautiful tradition of faith, prayer, and devotion. Welcome the Infant Jesus into your home and share in the joy of His birth.',
    ctaLabel: 'Register for Pax Tecum 2026',
    bgImage: '/pax-tecum/hero-visitation.jpg'
  },

  footer: {
    description:
      'Continuing a cherished Christmas tradition of faith, prayer, and service by bringing the Infant Jesus closer to our parish community.',
    copyright: '© 2026 Ministry of Altar Servers – Sacred Heart of Jesus Parish, Morning Breeze.'
  }
}
