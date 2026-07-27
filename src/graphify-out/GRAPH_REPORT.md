# Graph Report - src  (2026-06-09)

## Corpus Check
- 187 files · ~128,278 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1025 nodes · 2586 edges · 59 communities (57 shown, 2 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 11 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `274ec47f`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]

## God Nodes (most connected - your core abstractions)
1. `cn()` - 118 edges
2. `Icon()` - 99 edges
3. `Button` - 40 edges
4. `Section()` - 34 edges
5. `Reveal()` - 28 edges
6. `PageShell()` - 28 edges
7. `ProductCard` - 24 edges
8. `useCart()` - 21 edges
9. `Pill()` - 20 edges
10. `Card()` - 19 edges

## Surprising Connections (you probably didn't know these)
- `AdminOrderDetail()` --calls--> `itemCount()`  [INFERRED]
  app/admin/orders/[id]/page.tsx → components/ng/admin/orders-data.ts
- `AuthScreen()` --calls--> `useAuth()`  [EXTRACTED]
  app/auth/page.tsx → lib/auth.tsx
- `CheckoutPage()` --calls--> `useAddresses()`  [INFERRED]
  app/checkout/page.tsx → lib/addresses.tsx
- `CheckoutPage()` --calls--> `useAuth()`  [INFERRED]
  app/checkout/page.tsx → lib/auth.tsx
- `CheckoutPage()` --calls--> `useCart()`  [INFERRED]
  app/checkout/page.tsx → lib/cart.tsx

## Import Cycles
- None detected.

## Communities (59 total, 2 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.07
Nodes (34): CaptainCard(), CaptainRing(), CaptainSectionHead(), CaptainShell(), TABS, CAPTAIN, CaptainIdentity, CaptainStore (+26 more)

### Community 1 - "Community 1"
Cohesion: 0.06
Nodes (41): generateMetadata(), Certifications(), Faq(), FaqProps, KnowYour(), KnowYourProps, DEFAULT_CONTENT, FaqItem (+33 more)

### Community 2 - "Community 2"
Cohesion: 0.07
Nodes (33): ACTIVITY, AOV_SERIES, CATEGORY_MIX, DAY_LABELS, KPI, LOW_STOCK, ORDERS_SERIES, REVENUE_SERIES (+25 more)

### Community 3 - "Community 3"
Cohesion: 0.09
Nodes (20): CartLineItem(), CartContext, CartContextValue, useCart(), useWishlist(), WishlistContext, WishlistContextValue, WishlistProvider() (+12 more)

### Community 4 - "Community 4"
Cohesion: 0.12
Nodes (24): CsvParseResult, downloadCsv(), CsvImportDialog(), normaliseStatus(), parseProductCsv(), PRODUCT_CSV_HEADER, productsToCsv(), splitCsvLine() (+16 more)

### Community 5 - "Community 5"
Cohesion: 0.14
Nodes (13): FloatIn(), MagneticHover(), Parallax(), Reveal(), staggerItemReduced, staggerParent, Section(), SectionProps (+5 more)

### Community 6 - "Community 6"
Cohesion: 0.11
Nodes (20): AddressBook(), Editor, AddressCard(), AddressCardProps, TYPE_META, AddressForm(), AddressFormProps, AddressType (+12 more)

### Community 7 - "Community 7"
Cohesion: 0.13
Nodes (23): CheckoutDraft, clearCheckoutDraft(), readCheckoutDraft(), writeCheckoutDraft(), computeTotals(), COUPON_ERROR_MESSAGE, CouponError, CouponResult (+15 more)

### Community 8 - "Community 8"
Cohesion: 0.09
Nodes (15): BASE_URL, FARM_IMAGES, PRACTICES, REGIONS, CATEGORIES, CATEGORY_TONE, Chip(), ChipProps (+7 more)

### Community 9 - "Community 9"
Cohesion: 0.15
Nodes (19): ADMIN_ORDERS, AdminOrder, AdminOrderEvent, INR(), itemCount(), lotsInBox(), OrderChannel, OrderTone (+11 more)

### Community 10 - "Community 10"
Cohesion: 0.13
Nodes (18): AREA_BY_PINCODE, LocationContext, LocationContextValue, LocationProvider(), lookupArea(), SERVICEABLE_PINCODES, useLocation(), AREA_BY_PINCODE (+10 more)

### Community 11 - "Community 11"
Cohesion: 0.14
Nodes (18): Card(), AdminOrderItem, getOrder(), OrderStatus, STATUS_FLOW, AdminOrderDetail(), ActivityTimeline(), CustomerDeliveryCard() (+10 more)

### Community 12 - "Community 12"
Cohesion: 0.09
Nodes (17): IconifyJSON, LogoKind, PaymentLogo(), PaymentLogoProps, PROVIDERS, Accordion(), BANKS, CATEGORY_LABEL (+9 more)

### Community 13 - "Community 13"
Cohesion: 0.12
Nodes (16): hasTag(), Home(), PromoBar(), AssuranceStrip(), POINTS, CommunityCTA(), Hero(), FocusFilter (+8 more)

### Community 14 - "Community 14"
Cohesion: 0.12
Nodes (14): COUPONS, LOYALTY_LEDGER, CsvCell, CsvRow, downloadCsv(), downloadCsvBundle(), toCsv(), AdminReports() (+6 more)

### Community 15 - "Community 15"
Cohesion: 0.11
Nodes (14): Stagger(), staggerItem, PRODUCE_ICONS, CATEGORY_THEMES, CatTheme, FALLBACK_THEME, CATEGORY_TONE, Journal() (+6 more)

### Community 16 - "Community 16"
Cohesion: 0.12
Nodes (16): SlotPicker(), TraceabilityPanelProps, Category, DeliverySlot, Farm, JournalArticle, LotTraceability, Money (+8 more)

### Community 17 - "Community 17"
Cohesion: 0.16
Nodes (14): formatDate(), InvoiceDocument(), SELLER, amountInWords(), buildLines(), computeInvoiceTotals(), HSN_BY_TAG, inr2() (+6 more)

### Community 18 - "Community 18"
Cohesion: 0.18
Nodes (17): AdminRole, AdminSession, createToken(), encoder, fromBase64Url(), getSecret(), importKey(), isAdminRole() (+9 more)

### Community 19 - "Community 19"
Cohesion: 0.12
Nodes (7): CartView(), metadata, LINES, FARM_GALLERY, BUNDLE_LINEUP, PRODUCTS, PageShell()

### Community 20 - "Community 20"
Cohesion: 0.13
Nodes (8): metadata, POLICY_NAV, PolicyLayout(), PolicySection, metadata, metadata, metadata, metadata

### Community 21 - "Community 21"
Cohesion: 0.18
Nodes (10): loadReceipt(), OrderReceipt, DetailLine, MOCK_LINES, TIMELINE, InvoicePage(), SAMPLE_ADDRESS, SAMPLE_ITEMS (+2 more)

### Community 22 - "Community 22"
Cohesion: 0.13
Nodes (9): ACTIVE_BUNDLES, HOW, GROUPS, metadata, QA, PARTNERS, SAMPLE_REPORTS, TESTS (+1 more)

### Community 23 - "Community 23"
Cohesion: 0.11
Nodes (3): BENEFITS, SLIDE_META, SlideId

### Community 24 - "Community 24"
Cohesion: 0.22
Nodes (13): Badge(), BadgeProps, TONE_STYLES, ProduceIconName, Gallery(), GalleryImage, GalleryProps, UseTip (+5 more)

### Community 25 - "Community 25"
Cohesion: 0.12
Nodes (3): PRODUCE_ICON_DATA, ProduceIconData, IconProps

### Community 26 - "Community 26"
Cohesion: 0.17
Nodes (10): AdminIdentity(), AdminShell(), NAV, NavItem, roleLabel(), BundlesView(), AdminRole, getAdminEmail() (+2 more)

### Community 27 - "Community 27"
Cohesion: 0.14
Nodes (13): figtree, jetbrains, lora, metadata, robotoSlab, CartProvider(), LOYALTY_CONFIG, LoyaltyConfig (+5 more)

### Community 28 - "Community 28"
Cohesion: 0.24
Nodes (11): FilterPanel(), FilterPanelProps, RATINGS, ProductListingProps, SortMenu(), SortMenuProps, CATEGORY_TAGS, ShopFilters (+3 more)

### Community 29 - "Community 29"
Cohesion: 0.17
Nodes (10): metadata, PILLARS, STATS, TIMELINE, CartEmpty(), PICKS, TRUST, OrderSummary() (+2 more)

### Community 30 - "Community 30"
Cohesion: 0.19
Nodes (10): Pill(), stateOf(), StockAdjustDialog(), StockTarget, FILTERS, LOTS, PO_OPEN, SEED_STOCK (+2 more)

### Community 31 - "Community 31"
Cohesion: 0.16
Nodes (9): AuthScreen(), PERKS, ASSETS, Logo(), LogoProps, Tone, Variant, OtpInput() (+1 more)

### Community 32 - "Community 32"
Cohesion: 0.15
Nodes (12): CommandCenterHero(), Kpi, KpiChip(), PrimarySection(), SectionHeader(), ADMINS, LOG, LOG_META (+4 more)

### Community 33 - "Community 33"
Cohesion: 0.24
Nodes (10): AccountIdentity(), memberSinceLabel(), SignOutButton(), AccountSection, NAV, AccountPage(), ORDERS, STATS (+2 more)

### Community 34 - "Community 34"
Cohesion: 0.15
Nodes (6): StatTile(), CATEGORY_LABEL, CUSTOMERS, RANKED, TOP, TOTAL_SAVES

### Community 35 - "Community 35"
Cohesion: 0.17
Nodes (8): FILTERS, Filter, OrderHistoryPage(), OrderRow, ORDERS, OrderStatus, STATUS, useLiveReceipt()

### Community 36 - "Community 36"
Cohesion: 0.24
Nodes (9): NoCancellationAck(), NoCancellationNotice(), cn(), ProduceGlyph(), SearchBar(), SearchBarProps, Button(), buttonVariants (+1 more)

### Community 37 - "Community 37"
Cohesion: 0.18
Nodes (7): ConfigContent(), INITIAL_FEATURES, INR(), PAYMENT, SUB_NAV, ZONES, useLoyaltyConfig()

### Community 38 - "Community 38"
Cohesion: 0.21
Nodes (10): Campaign, CampaignDraft, CouponCampaignBuilder(), INR(), redemptionRate(), roi(), TARGET_MODES, TargetMode (+2 more)

### Community 39 - "Community 39"
Cohesion: 0.21
Nodes (5): metadata, ProductListing(), PILLARS, ShopTrustStrip(), CATEGORY_BLURBS

### Community 40 - "Community 40"
Cohesion: 0.26
Nodes (8): Footer(), NAV_GROUPS, FooterScene(), SOCIALS, ImpactBand(), ImpactBandProps, PdpCategoryContent, StorySectionProps

### Community 41 - "Community 41"
Cohesion: 0.21
Nodes (9): NumberField(), SaveBar(), SegToggle(), TextField(), Toggle(), ABUSE_GUARDS, DEFAULTS, ReferralConfig (+1 more)

### Community 42 - "Community 42"
Cohesion: 0.22
Nodes (8): AuthContext, AuthContextValue, AuthProvider(), isNgAccount(), NgAccount, readStoredAccount(), firebaseConfig, isFirebaseConfigured

### Community 43 - "Community 43"
Cohesion: 0.27
Nodes (7): SIZE_MAP, Stars(), StarsProps, Review, ReviewsProps, ReviewsSummaryProps, SortKey

### Community 44 - "Community 44"
Cohesion: 0.20
Nodes (4): AccountShell(), metadata, FRIENDS, STEPS

### Community 45 - "Community 45"
Cohesion: 0.27
Nodes (9): COMMERCE_RULES, CommerceConfigValue, CommerceContext, CommerceProvider(), normalizeRules(), readStoredRules(), useCommerceConfig(), useCommerceContext() (+1 more)

### Community 46 - "Community 46"
Cohesion: 0.24
Nodes (4): Input, InputProps, metadata, SEE

### Community 47 - "Community 47"
Cohesion: 0.29
Nodes (5): ContactForm(), SUBJECTS, CHANNELS, HOURS, metadata

### Community 48 - "Community 48"
Cohesion: 0.43
Nodes (5): BuyPanel(), BuyPanelProps, PdpVariant, VariantSelector(), VariantSelectorProps

### Community 49 - "Community 49"
Cohesion: 0.33
Nodes (6): DIETS, formatPhone(), GENDERS, PrefKey, PREFS, ProfilePage()

### Community 50 - "Community 50"
Cohesion: 0.33
Nodes (4): metadata, PERKS, ROLES, VALUES

### Community 51 - "Community 51"
Cohesion: 0.33
Nodes (4): Flow, FLOWS, Step, TONE_MAP

### Community 53 - "Community 53"
Cohesion: 0.33
Nodes (4): FACTS, KIT, MENTIONS, metadata

### Community 54 - "Community 54"
Cohesion: 0.33
Nodes (3): Node, TONE_BY_DEPTH, TREE

### Community 55 - "Community 55"
Cohesion: 0.33
Nodes (4): metadata, PROOF, STEPS, USE_CASES

### Community 56 - "Community 56"
Cohesion: 0.40
Nodes (4): FloatingPanel, FloatingPanelProps, GlassCard, GlassCardProps

## Knowledge Gaps
- **309 isolated node(s):** `metadata`, `STATS`, `PILLARS`, `TIMELINE`, `metadata` (+304 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Icon()` connect `Community 11` to `Community 0`, `Community 1`, `Community 2`, `Community 3`, `Community 4`, `Community 5`, `Community 6`, `Community 7`, `Community 9`, `Community 10`, `Community 12`, `Community 13`, `Community 14`, `Community 16`, `Community 17`, `Community 20`, `Community 21`, `Community 22`, `Community 23`, `Community 24`, `Community 26`, `Community 28`, `Community 29`, `Community 30`, `Community 31`, `Community 32`, `Community 33`, `Community 34`, `Community 35`, `Community 36`, `Community 37`, `Community 38`, `Community 39`, `Community 40`, `Community 41`, `Community 43`, `Community 44`, `Community 46`, `Community 47`, `Community 48`, `Community 49`, `Community 50`, `Community 52`, `Community 53`, `Community 55`?**
  _High betweenness centrality (0.200) - this node is a cross-community bridge._
- **Why does `cn()` connect `Community 36` to `Community 0`, `Community 1`, `Community 2`, `Community 3`, `Community 4`, `Community 5`, `Community 6`, `Community 7`, `Community 8`, `Community 10`, `Community 11`, `Community 12`, `Community 13`, `Community 15`, `Community 16`, `Community 19`, `Community 22`, `Community 24`, `Community 25`, `Community 26`, `Community 28`, `Community 30`, `Community 31`, `Community 32`, `Community 33`, `Community 34`, `Community 35`, `Community 38`, `Community 41`, `Community 43`, `Community 46`, `Community 48`, `Community 49`, `Community 56`?**
  _High betweenness centrality (0.124) - this node is a cross-community bridge._
- **Why does `Section()` connect `Community 5` to `Community 1`, `Community 36`, `Community 7`, `Community 8`, `Community 13`, `Community 47`, `Community 15`, `Community 50`, `Community 19`, `Community 51`, `Community 20`, `Community 22`, `Community 53`, `Community 54`, `Community 55`, `Community 29`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **What connects `metadata`, `STATS`, `PILLARS` to the rest of the system?**
  _309 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.06823529411764706 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.05877551020408163 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.07179487179487179 - nodes in this community are weakly interconnected._