// Enhanced Content Moderation System with Advanced Pattern Recognition
import fs from 'fs'
import crypto from 'crypto'

// Context-aware profanity detection with severity levels
const PROFANITY_TIERS = {
  MILD: {
    words: [
      'damn',
      'hell',
      'crap',
      'stupid',
      'dumb',
      'sucks',
      'dammit',
      'pissed',
      'piss',
    ],
    severity: 1,
    allowInContext: ['damn good', 'hell yeah', 'what the hell'],
  },
  MODERATE: {
    words: [
      'ass',
      'bitch',
      'shit',
      'dick',
      'prick',
      'douche',
      'jackass',
      'asshole',
    ],
    severity: 2,
    allowInContext: ['badass', 'smart ass', 'kick ass'],
  },
  SEVERE: {
    words: [
      'fuck',
      'fucking',
      'motherfucker',
      'cunt',
      'cocksucker',
      'bullshit',
    ],
    severity: 3,
    allowInContext: [],
  },
}

// Comprehensive obfuscation patterns with context awareness
const OBFUSCATION_PATTERNS = [
  // F-word variations
  {
    pattern: /\bf+[@*#_\-]?[u\*]?[c\*]k+(?:ing|ed|er|s)?\b/gi,
    word: 'fuck',
    severity: 3,
  },
  {
    pattern: /\bf+[@*#_\-]?[u\*]?[ck]+(?:ing|ed|er|s)?\b/gi,
    word: 'fuck',
    severity: 3,
  },

  // Shit variations
  { pattern: /\bsh[*#!@_\-]?[i1!]t+(?:ty|s)?\b/gi, word: 'shit', severity: 2 },

  // Bitch variations
  {
    pattern: /\bb[*#!@_\-]?[i1!][t7][c\*][h#]?(?:es|y|ing)?\b/gi,
    word: 'bitch',
    severity: 2,
  },

  // Ass variations
  {
    pattern: /\b[a@4][s\$5]{2}[h#]?[o0]?[l1]?[e3]?\b/gi,
    word: 'ass',
    severity: 2,
  },

  // Dick variations
  { pattern: /\bd[i1!][c\*][k#](?:head|s)?\b/gi, word: 'dick', severity: 2 },

  // Common leetspeak
  {
    pattern: /\b[a@4][s\$5]{2}[h#]?[o0][l1][e3]\b/gi,
    word: 'asshole',
    severity: 2,
  },
]

// Contextual hate speech patterns with severity scoring
const HATE_SPEECH_CATEGORIES = {
  VIOLENCE: {
    patterns: [
      /\b(?:kill|murder|shoot|stab|hang|lynch|gas|burn|torture)\s+(?:all\s+)?(?:the\s+)?(?:[a-z]+s|them|you)\b/gi,
      /\b(?:should|ought\s+to|gonna|going\s+to|will)\s+(?:be\s+)?(?:killed?|murdered?|shot|hanged|lynched)\b/gi,
      /\b(?:kill|murder)\s+(?:yourself|urself|your\s+self)\b/gi,
    ],
    severity: 10,
    requiresContext: true,
  },
  DEHUMANIZATION: {
    patterns: [
      /\b(?:subhuman|not\s+human|less\s+than\s+human|animals?|vermin|parasites?|cockroaches?)\b/gi,
      /\b(?:deserve\s+to\s+die|born\s+to\s+suffer|waste\s+of\s+(?:space|oxygen))\b/gi,
    ],
    severity: 8,
    requiresContext: true,
  },
  SLURS: {
    // Using hashed patterns to avoid storing explicit slurs
    hashedPatterns: [
      // Common slurs are hashed with their variations for detection
      'n-word-variants',
      'f-slur-variants',
      'homophobic-slurs',
      'racial-slurs',
      'transphobic-slurs',
    ],
    severity: 9,
    requiresContext: false,
  },
}

// Advanced slur detection using pattern matching without storing explicit terms
const SLUR_PATTERNS = [
  // N-word variations (heavily obfuscated detection)
  /\bn+[1!i]*[g]+[@a4]*[sg]+[a@4]*[rh]*\b/gi,
  /\bn+[e3]*[g]+[@a4]*[rh]+[o0]*\b/gi,

  // F-slur variations
  /\bf+[@a4]*[g]+[o0]*[t7]+\b/gi,
  /\bf+[@a4]*[g]+[g]*[o0]*[t7]*\b/gi,

  // Other common slurs (pattern-based without explicit storage)
  /\b[ck]+[h#]*[i1!]*[n]+[k#]+\b/gi,
  /\bs+[p]+[i1!]*[ck]+\b/gi,
  /\bt+[rh]+[@a4]*[n]+[n]*[y1!]*\b/gi,
]

// Contextual bullying patterns with escalation detection
const BULLYING_CATEGORIES = {
  DIRECT_ATTACKS: {
    patterns: [
      /\byou(?:'re|\s+are)\s+(?:such\s+)?(?:a\s+)?(?:fucking\s+|damn\s+)?(?:stupid|ugly|fat|worthless|pathetic|loser|idiot|moron|retard)\b/gi,
      /\b(?:nobody|no\s+one)\s+(?:likes|wants|cares\s+about)\s+you\b/gi,
      /\byou\s+should\s+(?:just\s+)?(?:die|kill\s+yourself|disappear|quit|leave)\b/gi,
    ],
    severity: 6,
  },
  HARASSMENT: {
    patterns: [
      /\b(?:get\s+(?:out|lost|away)|go\s+away|fuck\s+off)\b/gi,
      /\b(?:shut\s+(?:up|your\s+mouth)|stfu)\b/gi,
      /\byou(?:'re|\s+are)\s+(?:annoying|stupid|dumb)\b/gi,
    ],
    severity: 4,
  },
  THREATS: {
    patterns: [
      /\bi(?:'ll|\s+will)\s+(?:find|get|hurt|kill|destroy)\s+you\b/gi,
      /\byou(?:'re|\s+are)\s+(?:dead|finished|gonna\s+pay)\b/gi,
      /\bwatch\s+(?:your\s+back|out)\b/gi,
    ],
    severity: 8,
  },
}

// Spam detection with machine learning-like scoring
const SPAM_INDICATORS = {
  PROMOTIONAL: [
    /\b(?:click\s+here|visit\s+now|buy\s+now|order\s+now|call\s+now|act\s+fast)\b/gi,
    /\b(?:limited\s+time|offer\s+expires|while\s+supplies\s+last|don't\s+miss\s+out)\b/gi,
    /\b(?:free|earn)\s+(?:\$\d+|\d+\s*(?:dollars?|bucks?|money))/gi,
  ],
  SUSPICIOUS_LINKS: [
    /((?:https?:\/\/)?(?:bit\.ly|tinyurl|t\.co|goo\.gl|ow\.ly)\/[a-zA-Z0-9]+)/gi,
    /(?:https?:\/\/[^\s]+){3,}/gi, // Multiple links
  ],
  CRYPTO_SCAMS: [
    /\b(?:bitcoin|crypto|nft|investment|trading|profit)\s+(?:opportunity|guaranteed|system)\b/gi,
    /\b(?:double|triple)\s+your\s+(?:money|investment|bitcoin)\b/gi,
    /\b(?:passive\s+income|work\s+from\s+home|make\s+money\s+online)\b/gi,
  ],
}

// Personal information patterns with validation
const PERSONAL_INFO_PATTERNS = {
  SSN: {
    pattern: /\b(?:\d{3}-\d{2}-\d{4}|\d{9})\b/g,
    validate: (match) => {
      const digits = match.replace(/\D/g, '')
      return (
        digits.length === 9 &&
        !['000000000', '111111111', '123456789'].includes(digits)
      )
    },
  },
  PHONE: {
    pattern:
      /\b(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b/g,
    validate: (match) => {
      const digits = match.replace(/\D/g, '')
      return (
        digits.length >= 10 && !['0000000000', '1111111111'].includes(digits)
      )
    },
  },
  EMAIL: {
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    validate: (match) => match.includes('.') && match.split('@').length === 2,
  },
  CREDIT_CARD: {
    pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
    validate: (match) => {
      // Luhn algorithm check
      const digits = match.replace(/\D/g, '')
      if (digits.length !== 16) return false

      let sum = 0
      for (let i = 0; i < digits.length; i++) {
        let digit = parseInt(digits[i])
        if (i % 2 === 0) {
          digit *= 2
          if (digit > 9) digit -= 9
        }
        sum += digit
      }
      return sum % 10 === 0
    },
  },
}

// Advanced normalization with multiple techniques
const normalizeContent = (content) => {
  if (typeof content !== 'string') return ''

  // Unicode normalization and diacritic removal
  let normalized = content
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width characters
    .toLowerCase()

  // Leetspeak normalization
  const leetMap = {
    '@': 'a',
    4: 'a',
    '∀': 'a',
    8: 'b',
    ß: 'b',
    '©': 'c',
    '¢': 'c',
    '∂': 'd',
    Ð: 'd',
    3: 'e',
    '€': 'e',
    ë: 'e',
    6: 'g',
    9: 'g',
    '#': 'h',
    '|-|': 'h',
    '!': 'i',
    1: 'i',
    '|': 'i',
    í: 'i',
    7: 't',
    '†': 't',
    0: 'o',
    ø: 'o',
    ö: 'o',
    $: 's',
    5: 's',
    š: 's',
    '|_|': 'u',
    ü: 'u',
    vv: 'w',
    '\\/\\/': 'w',
  }

  Object.entries(leetMap).forEach(([leet, normal]) => {
    normalized = normalized.replace(
      new RegExp(leet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
      normal,
    )
  })

  return normalized
}

// Context-aware word boundary detection
const createContextPattern = (word, allowedContexts = []) => {
  const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  if (allowedContexts.length === 0) {
    return new RegExp(`\\b${escapedWord}\\b`, 'gi')
  }

  // Create negative lookahead/lookbehind for allowed contexts
  const contextPattern = allowedContexts
    .map((ctx) => {
      const parts = ctx.split(word)
      if (parts.length === 2) {
        const before = parts[0].trim()
        const after = parts[1].trim()
        return `(?<!${before}\\s)${escapedWord}(?!\\s${after})`
      }
      return escapedWord
    })
    .join('|')

  return new RegExp(
    `\\b(?!(?:${allowedContexts
      .join('|')
      .replace(new RegExp(word, 'g'), escapedWord)}))${escapedWord}\\b`,
    'gi',
  )
}

// Advanced false positive prevention
const FALSE_POSITIVE_WHITELIST = {
  // Location names and proper nouns
  locations: [
    'scunthorpe',
    'penistone',
    'lightwater',
    'clitheroe',
    'arsenal',
    'sussex',
    'middlesex',
    'essex',
    'dickson',
    'hancock',
    'cockburn',
    'pratt',
  ],
  // Technical terms
  technical: [
    'class',
    'sass',
    'less',
    'express',
    'async',
    'assert',
    'mass',
    'assignment',
    'assess',
    'process',
    'access',
    'success',
    'address',
  ],
  // Common words that might contain flagged substrings
  common: [
    'assumption',
    'assistance',
    'associate',
    'classic',
    'glass',
    'grass',
    'bass',
    'pass',
    'mass',
    'brass',
    'class',
  ],
}

// Load external configurations
let EXTERNAL_CONFIG = {
  customProfanity: [],
  customSlurs: [],
  whitelistedTerms: [],
  customPatterns: [],
}

const loadExternalConfig = () => {
  try {
    const configPaths = [
      process.env.MODERATION_CONFIG_PATH,
      './moderation-config.json',
      './config/moderation.json',
    ].filter(Boolean)

    for (const path of configPaths) {
      if (fs.existsSync(path)) {
        const config = JSON.parse(fs.readFileSync(path, 'utf8'))
        EXTERNAL_CONFIG = { ...EXTERNAL_CONFIG, ...config }
        break
      }
    }
  } catch (error) {
    console.warn('Failed to load external moderation config:', error.message)
  }
}

loadExternalConfig()

// Main moderation function with comprehensive analysis
export const moderateContent = (content, options = {}) => {
  const {
    strictMode = false,
    allowMildProfanity = false,
    contextAware = true,
    personalInfoCheck = true,
    spamCheck = true,
  } = options

  const results = {
    isClean: true,
    shouldBlock: false,
    shouldFlag: false,
    shouldWarn: false,
    confidence: 0,
    flags: {
      profanity: { detected: false, severity: 0, matches: [] },
      hateSpeech: { detected: false, severity: 0, matches: [] },
      bullying: { detected: false, severity: 0, matches: [] },
      spam: { detected: false, severity: 0, matches: [] },
      personalInfo: { detected: false, matches: [] },
      inappropriate: { detected: false, severity: 0, matches: [] },
    },
    issues: [],
    severity: 0,
    cleanedContent: content,
  }

  if (!content || typeof content !== 'string') {
    return results
  }

  const originalContent = content
  const normalized = normalizeContent(content)
  const compact = content.replace(/[^a-z0-9]+/gi, '').toLowerCase()

  // Check for false positives first
  if (isLikelyFalsePositive(content, normalized)) {
    return results
  }

  // 1. Profanity Detection with Context Awareness
  const profanityResults = detectProfanity(
    content,
    normalized,
    compact,
    contextAware,
    allowMildProfanity,
  )
  if (profanityResults.detected) {
    results.flags.profanity = profanityResults
    results.severity += profanityResults.severity
    results.issues.push(`Profanity detected (${profanityResults.severity}/10)`)

    if (profanityResults.severity >= 3) {
      results.shouldFlag = true
    }
    if (profanityResults.severity >= 5 || strictMode) {
      results.shouldWarn = true
    }
  }

  // 2. Hate Speech Detection
  const hateSpeechResults = detectHateSpeech(content, normalized, contextAware)
  if (hateSpeechResults.detected) {
    results.flags.hateSpeech = hateSpeechResults
    results.severity += hateSpeechResults.severity
    results.issues.push(
      `Hate speech detected (${hateSpeechResults.severity}/10)`,
    )
    results.shouldBlock = true
    results.shouldFlag = true
  }

  // 3. Slur Detection
  const slurResults = detectSlurs(content, normalized, compact)
  if (slurResults.detected) {
    results.flags.hateSpeech.detected = true
    results.flags.hateSpeech.severity = Math.max(
      results.flags.hateSpeech.severity,
      slurResults.severity,
    )
    results.flags.hateSpeech.matches.push(...slurResults.matches)
    results.severity += slurResults.severity
    results.issues.push(`Slurs detected (${slurResults.severity}/10)`)
    results.shouldBlock = true
    results.shouldFlag = true
  }

  // 4. Bullying Detection
  const bullyingResults = detectBullying(content, normalized, contextAware)
  if (bullyingResults.detected) {
    results.flags.bullying = bullyingResults
    results.severity += bullyingResults.severity
    results.issues.push(
      `Bullying/harassment detected (${bullyingResults.severity}/10)`,
    )

    if (bullyingResults.severity >= 6) {
      results.shouldBlock = true
    }
    results.shouldFlag = true
  }

  // 5. Spam Detection
  if (spamCheck) {
    const spamResults = detectSpam(content, normalized)
    if (spamResults.detected) {
      results.flags.spam = spamResults
      results.severity += spamResults.severity
      results.issues.push(`Spam detected (${spamResults.severity}/10)`)

      if (spamResults.severity >= 7) {
        results.shouldBlock = true
      }
      results.shouldFlag = true
    }
  }

  // 6. Personal Information Detection
  if (personalInfoCheck) {
    const personalInfoResults = detectPersonalInfo(content)
    if (personalInfoResults.detected) {
      results.flags.personalInfo = personalInfoResults
      results.severity += 3
      results.issues.push('Personal information detected')
      results.shouldFlag = true
      results.cleanedContent = filterPersonalInfo(content)
    }
  }

  // 7. Additional Quality Checks
  const qualityResults = performQualityChecks(content)
  results.severity += qualityResults.severity
  if (qualityResults.issues.length > 0) {
    results.issues.push(...qualityResults.issues)
    if (qualityResults.severity >= 2) {
      results.shouldFlag = true
    }
  }

  // Final scoring and decision making
  results.isClean = results.severity === 0
  results.confidence = calculateConfidence(results)

  // Apply filtered content
  if (!results.shouldBlock) {
    results.cleanedContent = applyContentFilters(originalContent, results.flags)
  }

  return results
}

// Individual detection functions
const detectProfanity = (
  content,
  normalized,
  compact,
  contextAware,
  allowMild,
) => {
  const results = { detected: false, severity: 0, matches: [] }

  // Check tier-based profanity
  Object.entries(PROFANITY_TIERS).forEach(([tier, config]) => {
    if (allowMild && tier === 'MILD') return

    config.words.forEach((word) => {
      const pattern = contextAware
        ? createContextPattern(word, config.allowInContext)
        : new RegExp(`\\b${word}\\b`, 'gi')

      if (pattern.test(content) || pattern.test(normalized)) {
        results.detected = true
        results.severity = Math.max(results.severity, config.severity)
        results.matches.push({ word, tier, severity: config.severity })
      }
    })
  })

  // Check obfuscated patterns
  OBFUSCATION_PATTERNS.forEach(({ pattern, word, severity }) => {
    if (
      pattern.test(content) ||
      pattern.test(normalized) ||
      pattern.test(compact)
    ) {
      results.detected = true
      results.severity = Math.max(results.severity, severity)
      results.matches.push({ word: `${word} (obfuscated)`, severity })
    }
  })

  return results
}

const detectHateSpeech = (content, normalized, contextAware) => {
  const results = { detected: false, severity: 0, matches: [] }

  Object.entries(HATE_SPEECH_CATEGORIES).forEach(([category, config]) => {
    if (config.patterns) {
      config.patterns.forEach((pattern) => {
        if (pattern.test(content) || pattern.test(normalized)) {
          // Additional context validation for violence category
          if (category === 'VIOLENCE' && config.requiresContext) {
            if (!hasValidHateSpeechContext(content)) return
          }

          results.detected = true
          results.severity = Math.max(results.severity, config.severity)
          results.matches.push({ category, severity: config.severity })
        }
      })
    }
  })

  return results
}

const detectSlurs = (content, normalized, compact) => {
  const results = { detected: false, severity: 9, matches: [] }

  SLUR_PATTERNS.forEach((pattern, index) => {
    if (
      pattern.test(content) ||
      pattern.test(normalized) ||
      pattern.test(compact)
    ) {
      // Additional validation to prevent false positives
      const matches = content.match(pattern) || []
      const validMatches = matches.filter((match) => {
        // Check against whitelist and common false positives
        return !isLikelyFalsePositive(match, match.toLowerCase())
      })

      if (validMatches.length > 0) {
        results.detected = true
        results.matches.push({
          type: `slur-pattern-${index}`,
          count: validMatches.length,
        })
      }
    }
  })

  return results
}

const detectBullying = (content, normalized, contextAware) => {
  const results = { detected: false, severity: 0, matches: [] }

  Object.entries(BULLYING_CATEGORIES).forEach(([category, config]) => {
    config.patterns.forEach((pattern) => {
      if (pattern.test(content) || pattern.test(normalized)) {
        results.detected = true
        results.severity = Math.max(results.severity, config.severity)
        results.matches.push({ category, severity: config.severity })
      }
    })
  })

  return results
}

const detectSpam = (content, normalized) => {
  const results = { detected: false, severity: 0, matches: [] }
  let spamScore = 0

  Object.entries(SPAM_INDICATORS).forEach(([category, patterns]) => {
    patterns.forEach((pattern) => {
      const matches = (content.match(pattern) || []).length
      if (matches > 0) {
        spamScore += matches * 2
        results.matches.push({ category, count: matches })
      }
    })
  })

  // Additional spam indicators
  const repetitivePattern = /(.{3,})\1{3,}/g
  if (repetitivePattern.test(content)) spamScore += 3

  const excessiveEmojis = (
    content.match(
      /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/gu,
    ) || []
  ).length
  if (excessiveEmojis > 10) spamScore += Math.min(excessiveEmojis - 10, 5)

  const excessiveCaps = content.replace(/[^A-Z]/g, '').length
  const totalLetters = content.replace(/[^A-Za-z]/g, '').length
  if (totalLetters > 10 && excessiveCaps / totalLetters > 0.7) spamScore += 2

  if (spamScore > 0) {
    results.detected = true
    results.severity = Math.min(spamScore, 10)
  }

  return results
}

const detectPersonalInfo = (content) => {
  const results = { detected: false, matches: [] }

  Object.entries(PERSONAL_INFO_PATTERNS).forEach(([type, config]) => {
    const matches = content.match(config.pattern) || []
    const validMatches = matches.filter((match) =>
      config.validate ? config.validate(match) : true,
    )

    if (validMatches.length > 0) {
      results.detected = true
      results.matches.push({
        type,
        count: validMatches.length,
        samples: validMatches.slice(0, 2),
      })
    }
  })

  return results
}

const performQualityChecks = (content) => {
  const results = { severity: 0, issues: [] }

  // Excessive repetition
  if (/(.)\1{10,}/.test(content)) {
    results.severity += 1
    results.issues.push('Excessive character repetition')
  }

  // All caps (for longer messages)
  if (
    content.length > 20 &&
    content === content.toUpperCase() &&
    /[A-Z]{10,}/.test(content)
  ) {
    results.severity += 1
    results.issues.push('Excessive capitalization')
  }

  // Excessive punctuation
  if (/[!?]{5,}/.test(content)) {
    results.severity += 1
    results.issues.push('Excessive punctuation')
  }

  return results
}

// Helper functions
const isLikelyFalsePositive = (original, normalized) => {
  const allWhitelisted = [
    ...FALSE_POSITIVE_WHITELIST.locations,
    ...FALSE_POSITIVE_WHITELIST.technical,
    ...FALSE_POSITIVE_WHITELIST.common,
    ...EXTERNAL_CONFIG.whitelistedTerms,
  ]

  return allWhitelisted.some((term) => {
    const termNormalized = normalizeContent(term)
    return (
      original.toLowerCase().includes(term.toLowerCase()) ||
      normalized.includes(termNormalized)
    )
  })
}

const hasValidHateSpeechContext = (content) => {
  // Check if the content has sufficient context to be considered hate speech
  const contextWords = content.toLowerCase().split(/\s+/).length
  return contextWords >= 5 // Require at least 5 words for hate speech classification
}

const calculateConfidence = (results) => {
  let confidence = 50 // Base confidence

  // Increase confidence based on multiple flags
  const flagCount = Object.values(results.flags).filter(
    (flag) => flag.detected,
  ).length
  confidence += flagCount * 15

  // Increase confidence based on severity
  confidence += Math.min(results.severity * 5, 30)

  // Decrease confidence if only mild issues
  if (results.severity <= 2) confidence -= 20

  return Math.min(Math.max(confidence, 0), 100)
}

const applyContentFilters = (content, flags) => {
  let filtered = content

  // Filter profanity
  if (flags.profanity.detected) {
    flags.profanity.matches.forEach((match) => {
      if (match.word && !match.word.includes('obfuscated')) {
        const regex = new RegExp(`\\b${match.word}\\b`, 'gi')
        filtered = filtered.replace(regex, '*'.repeat(match.word.length))
      }
    })

    // Apply obfuscation pattern filtering
    OBFUSCATION_PATTERNS.forEach(({ pattern, word }) => {
      filtered = filtered.replace(pattern, '*'.repeat(word.length))
    })
  }

  return filtered
}

const filterPersonalInfo = (content) => {
  let filtered = content

  Object.entries(PERSONAL_INFO_PATTERNS).forEach(([type, config]) => {
    const replacement =
      type === 'EMAIL'
        ? '[EMAIL]'
        : type === 'PHONE'
        ? '[PHONE]'
        : type === 'SSN'
        ? '[SSN]'
        : type === 'CREDIT_CARD'
        ? '[CARD]'
        : '[REDACTED]'

    filtered = filtered.replace(config.pattern, replacement)
  })

  return filtered
}

// User behavior analysis with advanced risk scoring
export const analyzeUserBehavior = async (userId, User, Post, Report) => {
  try {
    const user = await User.findById(userId)
    if (!user) return null

    const now = new Date()
    const dayMs = 24 * 60 * 60 * 1000
    const weekAgo = new Date(now - 7 * dayMs)
    const monthAgo = new Date(now - 30 * dayMs)

    // Get comprehensive user data
    const [recentPosts, allPosts, reports, userReports] = await Promise.all([
      Post.find({
        author: userId,
        createdAt: { $gte: weekAgo },
      }).sort({ createdAt: -1 }),

      Post.find({ author: userId }).sort({ createdAt: -1 }).limit(100),

      Report.find({
        reportedUser: userId,
        createdAt: { $gte: monthAgo },
      }),

      Report.find({
        reportedBy: userId,
        createdAt: { $gte: monthAgo },
      }),
    ])

    // Calculate advanced risk metrics
    const riskFactors = calculateAdvancedRiskScore(
      user,
      recentPosts,
      allPosts,
      reports,
      userReports,
    )
    const behaviorPattern = analyzeBehaviorPattern(recentPosts, allPosts)
    const contentQuality = analyzeContentQuality(recentPosts)

    return {
      userId,
      riskScore: riskFactors.totalScore,
      riskLevel: getRiskLevel(riskFactors.totalScore),
      factors: riskFactors,
      behaviorPattern,
      contentQuality,
      recentActivity: {
        postCount: recentPosts.length,
        reportCount: reports.length,
        reportsFiledCount: userReports.length,
      },
      recommendations: generateAdvancedRecommendations(
        riskFactors,
        behaviorPattern,
        contentQuality,
      ),
      nextReviewDate: calculateNextReviewDate(riskFactors.totalScore),
    }
  } catch (error) {
    console.error('Error analyzing user behavior:', error)
    return null
  }
}

const calculateAdvancedRiskScore = (
  user,
  recentPosts,
  allPosts,
  reports,
  userReports,
) => {
  const factors = {
    accountAge: 0,
    postFrequency: 0,
    reportHistory: 0,
    contentViolations: 0,
    engagementScore: 0,
    behaviorConsistency: 0,
    communityInteraction: 0,
    totalScore: 0,
  }

  // 1. Account Age Factor (newer accounts are riskier)
  const accountAge = Date.now() - new Date(user.createdAt).getTime()
  const daysSinceCreation = accountAge / (1000 * 60 * 60 * 24)

  if (daysSinceCreation < 1) factors.accountAge = 5
  else if (daysSinceCreation < 7) factors.accountAge = 3
  else if (daysSinceCreation < 30) factors.accountAge = 2
  else if (daysSinceCreation < 90) factors.accountAge = 1
  else factors.accountAge = 0

  // 2. Post Frequency Analysis
  if (recentPosts.length > 50) factors.postFrequency = 4
  else if (recentPosts.length > 30) factors.postFrequency = 3
  else if (recentPosts.length > 20) factors.postFrequency = 2
  else if (recentPosts.length > 15) factors.postFrequency = 1

  // Check for burst posting (many posts in short time)
  const hourlyPosts = groupPostsByHour(recentPosts)
  const maxPostsPerHour = Math.max(...Object.values(hourlyPosts))
  if (maxPostsPerHour > 10) factors.postFrequency += 3
  else if (maxPostsPerHour > 5) factors.postFrequency += 1

  // 3. Report History
  factors.reportHistory = Math.min(reports.length * 2, 10)

  // Weight recent reports more heavily
  const recentReports = reports.filter(
    (r) =>
      new Date(r.createdAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  )
  factors.reportHistory += recentReports.length * 3

  // 4. Content Violations
  let violationScore = 0
  recentPosts.forEach((post) => {
    if (post.moderationFlags) {
      violationScore += post.moderationFlags.severity || 0
    }
  })
  factors.contentViolations = Math.min(violationScore / 5, 10)

  // 5. Engagement Score (low engagement might indicate bot/spam)
  const totalEngagement = allPosts.reduce(
    (sum, post) =>
      sum + (post.likes?.length || 0) + (post.comments?.length || 0),
    0,
  )
  const avgEngagement = totalEngagement / Math.max(allPosts.length, 1)

  if (allPosts.length > 10) {
    if (avgEngagement < 0.5) factors.engagementScore = 3
    else if (avgEngagement < 1) factors.engagementScore = 2
    else if (avgEngagement < 2) factors.engagementScore = 1
  }

  // 6. Behavior Consistency
  const behaviorScore = analyzeBehaviorConsistency(allPosts)
  factors.behaviorConsistency = behaviorScore

  // 7. Community Interaction Quality
  const interactionScore = analyzeCommunityInteraction(userReports, reports)
  factors.communityInteraction = interactionScore

  // Calculate total with weights
  factors.totalScore = Math.min(
    factors.accountAge * 1.2 +
      factors.postFrequency * 1.0 +
      factors.reportHistory * 1.5 +
      factors.contentViolations * 2.0 +
      factors.engagementScore * 0.8 +
      factors.behaviorConsistency * 1.3 +
      factors.communityInteraction * 1.1,
    10,
  )

  return factors
}

const groupPostsByHour = (posts) => {
  const hourlyPosts = {}
  posts.forEach((post) => {
    const hour = new Date(post.createdAt).getHours()
    hourlyPosts[hour] = (hourlyPosts[hour] || 0) + 1
  })
  return hourlyPosts
}

const analyzeBehaviorPattern = (recentPosts, allPosts) => {
  const pattern = {
    consistency: 'stable',
    trend: 'neutral',
    riskIndicators: [],
  }

  // Analyze posting patterns
  const recentAvgLength =
    recentPosts.reduce((sum, p) => sum + (p.content?.length || 0), 0) /
    recentPosts.length
  const overallAvgLength =
    allPosts.reduce((sum, p) => sum + (p.content?.length || 0), 0) /
    allPosts.length

  // Detect sudden changes in behavior
  if (recentAvgLength < overallAvgLength * 0.3 && recentPosts.length > 5) {
    pattern.riskIndicators.push('Sudden decrease in content quality')
    pattern.consistency = 'declining'
  }

  if (recentPosts.length > allPosts.length * 0.5 && allPosts.length > 20) {
    pattern.riskIndicators.push('Sudden increase in posting frequency')
    pattern.trend = 'escalating'
  }

  // Check for copy-paste behavior
  const duplicateContent = findDuplicateContent(recentPosts)
  if (duplicateContent > 0.3) {
    pattern.riskIndicators.push('High duplicate content ratio')
  }

  // Analyze time patterns
  const timePattern = analyzePostingTimes(recentPosts)
  if (timePattern.botLike) {
    pattern.riskIndicators.push('Bot-like posting pattern detected')
  }

  return pattern
}

const analyzeContentQuality = (posts) => {
  if (posts.length === 0) return { score: 5, issues: [] }

  const quality = {
    score: 5,
    issues: [],
    metrics: {
      avgLength: 0,
      readability: 5,
      originalityScore: 5,
      engagementRate: 0,
    },
  }

  // Calculate average content length
  quality.metrics.avgLength =
    posts.reduce((sum, p) => sum + (p.content?.length || 0), 0) / posts.length

  // Analyze readability (simple heuristic)
  const readabilityScores = posts.map((post) =>
    calculateReadabilityScore(post.content || ''),
  )
  quality.metrics.readability =
    readabilityScores.reduce((sum, score) => sum + score, 0) /
    readabilityScores.length

  // Check for spam-like patterns
  const spamIndicators = posts.filter((post) => {
    const result = moderateContent(post.content || '', { spamCheck: true })
    return result.flags.spam.detected
  })

  if (spamIndicators.length > posts.length * 0.3) {
    quality.score -= 3
    quality.issues.push('High spam content ratio')
  }

  // Check originality
  const duplicateRatio = findDuplicateContent(posts)
  if (duplicateRatio > 0.5) {
    quality.score -= 2
    quality.issues.push('Low content originality')
  }

  quality.metrics.originalityScore = Math.max(5 - duplicateRatio * 5, 0)

  return quality
}

const analyzeBehaviorConsistency = (posts) => {
  if (posts.length < 5) return 0

  let inconsistencyScore = 0

  // Check for dramatic changes in content length
  const lengths = posts.map((p) => p.content?.length || 0)
  const avgLength = lengths.reduce((sum, len) => sum + len, 0) / lengths.length
  const variance =
    lengths.reduce((sum, len) => sum + Math.pow(len - avgLength, 2), 0) /
    lengths.length

  if (variance > avgLength * avgLength) inconsistencyScore += 2

  // Check posting time patterns
  const hours = posts.map((p) => new Date(p.createdAt).getHours())
  const hourVariance = calculateVariance(hours)

  if (hourVariance < 2) inconsistencyScore += 1 // Too consistent (bot-like)
  if (hourVariance > 10) inconsistencyScore += 1 // Too random

  return Math.min(inconsistencyScore, 5)
}

const analyzeCommunityInteraction = (userReports, reportsAgainst) => {
  let score = 0

  // Check if user files excessive reports (might be harassment)
  if (userReports.length > 10) score += 2
  if (userReports.length > 20) score += 3

  // Check report accuracy (if we have resolution data)
  const falseReports = userReports.filter(
    (r) => r.status === 'dismissed',
  ).length
  const falseReportRatio = falseReports / Math.max(userReports.length, 1)

  if (falseReportRatio > 0.7 && userReports.length > 5) {
    score += 3 // High false report ratio
  }

  return Math.min(score, 5)
}

const findDuplicateContent = (posts) => {
  if (posts.length < 2) return 0

  const contents = posts.map((p) =>
    (p.content || '').toLowerCase().replace(/\s+/g, ' ').trim(),
  )
  let duplicates = 0

  for (let i = 0; i < contents.length; i++) {
    for (let j = i + 1; j < contents.length; j++) {
      if (calculateSimilarity(contents[i], contents[j]) > 0.8) {
        duplicates++
      }
    }
  }

  return duplicates / Math.max(contents.length - 1, 1)
}

const calculateSimilarity = (str1, str2) => {
  if (!str1 || !str2) return 0

  const words1 = str1.split(/\s+/)
  const words2 = str2.split(/\s+/)

  const set1 = new Set(words1)
  const set2 = new Set(words2)

  const intersection = new Set([...set1].filter((x) => set2.has(x)))
  const union = new Set([...set1, ...set2])

  return intersection.size / union.size
}

const analyzePostingTimes = (posts) => {
  const hours = posts.map((p) => new Date(p.createdAt).getHours())
  const hourCounts = {}

  hours.forEach((hour) => {
    hourCounts[hour] = (hourCounts[hour] || 0) + 1
  })

  // Check for bot-like patterns (posting at exact intervals)
  const intervals = []
  for (let i = 1; i < posts.length; i++) {
    const interval =
      new Date(posts[i - 1].createdAt) - new Date(posts[i].createdAt)
    intervals.push(Math.abs(interval))
  }

  const avgInterval =
    intervals.reduce((sum, int) => sum + int, 0) / intervals.length
  const intervalVariance = calculateVariance(intervals)

  return {
    botLike: intervalVariance < avgInterval * 0.1 && posts.length > 10,
    hourDistribution: hourCounts,
    avgIntervalMs: avgInterval,
  }
}

const calculateVariance = (numbers) => {
  const avg = numbers.reduce((sum, num) => sum + num, 0) / numbers.length
  return (
    numbers.reduce((sum, num) => sum + Math.pow(num - avg, 2), 0) /
    numbers.length
  )
}

const calculateReadabilityScore = (text) => {
  if (!text || text.length < 10) return 2

  const sentences = text.split(/[.!?]+/).length
  const words = text.split(/\s+/).length
  const avgWordsPerSentence = words / Math.max(sentences, 1)

  // Simple readability heuristic
  let score = 5
  if (avgWordsPerSentence > 25) score -= 2 // Too complex
  if (avgWordsPerSentence < 5) score -= 1 // Too simple/fragmented
  if (text.length < 20) score -= 1 // Too short

  return Math.max(Math.min(score, 10), 0)
}

const getRiskLevel = (score) => {
  if (score >= 8) return 'CRITICAL'
  if (score >= 6) return 'HIGH'
  if (score >= 4) return 'MEDIUM'
  if (score >= 2) return 'LOW'
  return 'MINIMAL'
}

const generateAdvancedRecommendations = (
  riskFactors,
  behaviorPattern,
  contentQuality,
) => {
  const recommendations = []
  const actions = []

  // Critical risk recommendations
  if (riskFactors.totalScore >= 8) {
    actions.push('IMMEDIATE_REVIEW')
    recommendations.push('Immediate manual review required')

    if (riskFactors.reportHistory >= 8) {
      actions.push('TEMPORARY_SUSPENSION')
      recommendations.push(
        'Consider temporary suspension pending investigation',
      )
    }
  }

  // High risk recommendations
  if (riskFactors.totalScore >= 6) {
    actions.push('ENHANCED_MONITORING')
    recommendations.push('Enable enhanced monitoring for 48-72 hours')

    if (riskFactors.contentViolations >= 6) {
      actions.push('CONTENT_RESTRICTION')
      recommendations.push('Restrict posting privileges until review')
    }
  }

  // Medium risk recommendations
  if (riskFactors.totalScore >= 4) {
    actions.push('INCREASED_MONITORING')
    recommendations.push('Increase moderation check frequency')

    if (behaviorPattern.riskIndicators.length > 2) {
      recommendations.push(
        'Send educational warning about community guidelines',
      )
    }
  }

  // Content quality issues
  if (contentQuality.score < 3) {
    recommendations.push('Flag for content quality review')

    if (contentQuality.issues.includes('High spam content ratio')) {
      actions.push('SPAM_FILTER')
      recommendations.push('Apply enhanced spam filtering')
    }
  }

  // Account age specific recommendations
  if (riskFactors.accountAge >= 3) {
    recommendations.push('Apply new user restrictions')
    actions.push('NEW_USER_MONITORING')
  }

  // Behavior pattern specific recommendations
  if (
    behaviorPattern.riskIndicators.includes('Bot-like posting pattern detected')
  ) {
    actions.push('BOT_VERIFICATION')
    recommendations.push('Require CAPTCHA verification for posts')
  }

  return { recommendations, actions }
}

const calculateNextReviewDate = (riskScore) => {
  const now = new Date()
  let daysUntilReview

  if (riskScore >= 8) daysUntilReview = 1
  else if (riskScore >= 6) daysUntilReview = 3
  else if (riskScore >= 4) daysUntilReview = 7
  else if (riskScore >= 2) daysUntilReview = 14
  else daysUntilReview = 30

  return new Date(now.getTime() + daysUntilReview * 24 * 60 * 60 * 1000)
}

// Enhanced moderation statistics
export const getModerationStats = async (Post, Report, User) => {
  const now = new Date()
  const timeRanges = {
    today: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
    weekAgo: new Date(now - 7 * 24 * 60 * 60 * 1000),
    monthAgo: new Date(now - 30 * 24 * 60 * 60 * 1000),
  }

  try {
    const [
      pendingReports,
      reportsToday,
      reportsThisWeek,
      reportsThisMonth,
      flaggedPosts,
      approvedPosts,
      bannedUsers,
      warnedUsers,
      highRiskUsers,
      contentViolations,
    ] = await Promise.all([
      Report.countDocuments({ status: 'pending' }),
      Report.countDocuments({ createdAt: { $gte: timeRanges.today } }),
      Report.countDocuments({ createdAt: { $gte: timeRanges.weekAgo } }),
      Report.countDocuments({ createdAt: { $gte: timeRanges.monthAgo } }),
      Post.countDocuments({
        $or: [{ isApproved: false }, { 'moderationFlags.shouldFlag': true }],
      }),
      Post.countDocuments({ isApproved: true }),
      User.countDocuments({ 'moderationStatus.isBanned': true }),
      User.countDocuments({ 'moderationStatus.warningCount': { $gt: 0 } }),
      User.countDocuments({ 'moderationStatus.riskScore': { $gte: 6 } }),
      Post.countDocuments({
        'moderationFlags.severity': { $gte: 5 },
        createdAt: { $gte: timeRanges.weekAgo },
      }),
    ])

    // Calculate trends
    const [reportsLastWeek, reportsWeekBefore] = await Promise.all([
      Report.countDocuments({
        createdAt: {
          $gte: timeRanges.weekAgo,
          $lt: now,
        },
      }),
      Report.countDocuments({
        createdAt: {
          $gte: new Date(now - 14 * 24 * 60 * 60 * 1000),
          $lt: timeRanges.weekAgo,
        },
      }),
    ])

    const reportTrend =
      reportsWeekBefore === 0
        ? 0
        : ((reportsLastWeek - reportsWeekBefore) / reportsWeekBefore) * 100

    return {
      overview: {
        pendingReports,
        flaggedPosts,
        moderationLoad: pendingReports + flaggedPosts,
        bannedUsers,
        highRiskUsers,
      },
      activity: {
        reportsToday,
        reportsThisWeek,
        reportsThisMonth,
        approvedPosts,
        contentViolations,
      },
      trends: {
        reportTrend: Math.round(reportTrend),
        riskLevel: calculateOverallRiskLevel(
          pendingReports,
          flaggedPosts,
          highRiskUsers,
        ),
      },
      userStats: {
        totalWarned: warnedUsers,
        totalBanned: bannedUsers,
        highRisk: highRiskUsers,
      },
    }
  } catch (error) {
    console.error('Error getting moderation stats:', error)
    return null
  }
}

const calculateOverallRiskLevel = (
  pendingReports,
  flaggedPosts,
  highRiskUsers,
) => {
  const totalIssues = pendingReports + flaggedPosts + highRiskUsers

  if (totalIssues >= 100) return 'CRITICAL'
  if (totalIssues >= 50) return 'HIGH'
  if (totalIssues >= 20) return 'MEDIUM'
  if (totalIssues >= 5) return 'LOW'
  return 'MINIMAL'
}

// Utility function for batch content moderation
export const moderateContentBatch = async (contents, options = {}) => {
  const results = []
  const batchSize = options.batchSize || 100

  for (let i = 0; i < contents.length; i += batchSize) {
    const batch = contents.slice(i, i + batchSize)
    const batchResults = batch.map((content) =>
      moderateContent(content, options),
    )
    results.push(...batchResults)

    // Small delay to prevent overwhelming the system
    if (i + batchSize < contents.length) {
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
  }

  return results
}

// Export main functions
export default {
  moderateContent,
  analyzeUserBehavior,
  getModerationStats,
  moderateContentBatch,
  filterPersonalInfo,
  loadExternalConfig,
}
