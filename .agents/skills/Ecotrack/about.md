# Ecotrack couriers integration guide (DHD, Conexlog, MSM Go & 80 more)

Ecotrack isn't a courier; it's the platform a large slice of Algeria's regional
couriers run on. DHD, Conexlog, MSM Go, World Express and dozens of others are
each independent delivery companies with their own fleets and pricing, all
exposing the same Ecotrack API on their own domain.

That's good news for you: one integration, 82 couriers. Pick the regional
courier your customers trust, and the code doesn't change.

## What you need

Just your API token from that courier's dashboard:

| | Field | Example |
|---|---|---|
| API token | `credentials.token` | `eyJ0…` |

**You do not need to know the courier's URL.** Every Ecotrack courier below has
its own `courier` key, and dzship keeps the address. Use
`"courier": "dhd"`, not `"courier": "ecotrack"` plus a URL you had to look up.

If your courier runs Ecotrack but isn't in the list yet, fall back to the
generic key and name the tenant yourself — it must be a `*.ecotrack.dz` host:

```json
{ "courier": "ecotrack", "credentials": { "token": "…" },
  "options": { "baseUrl": "https://yourname.ecotrack.dz" } }
```

## The 82 Ecotrack couriers


| Courier | `courier` key |
|---|---|
| 48Hr Livraison | `e48hrlivraison` |
| AB Delivery | `abdelivery` |
| Alania Express | `alania` |
| Allo Livraison | `allolivraison` |
| Amana Speed | `amana` |
| Anderson Delivery | `andersondelivery` |
| Aranex | `aranex` |
| Areex | `areex` |
| Assil Delivery | `assildelivery` |
| Atlas Express | `atlasexpress` |
| BA Consult | `baconsult` |
| BFK Express | `bfkexpress` |
| Boogi Technologie | `boogi` |
| Champion Logistics | `championlogistics` |
| Chronorex | `chronorex` |
| Cirta Express | `cirtaexpress` |
| Colex | `colex` |
| Colireli | `colireli` |
| Colizone | `colizone` |
| Conexlog | `conexlog` |
| Coyote Express | `coyoteexpress` |
| Delivromail | `delivromail` |
| DHD Livraison | `dhd` |
| Distazero | `distazero` |
| Eco Rapide Express | `ecorapideexpress` |
| El Guide Delivery | `elguidedelivery` |
| Expedia Chrono | `expediachrono` |
| Fast Horse Express | `fasthorse` |
| FRET.Direct | `fretdirect` |
| FZ Delivery | `fzdelivery` |
| GOLIVRI | `golivri` |
| GS Ecommerce | `gsecommerce` |
| HHD Express | `hhdexpress` |
| Imir Logistics | `imir` |
| Jaguar Livraison | `jaguar` |
| Jo Express | `joexpress` |
| LIH LIH Express | `lihlihexpress` |
| Lynx Express | `lynx` |
| Majorex | `majorex` |
| Mazaya Logistics | `mazaya` |
| Med Express | `medexpress` |
| Mono Hub | `monohub` |
| MSM Go | `msmgo` |
| Navex Delivery | `navexdelivery` |
| Negmar Express | `negmarexpress` |
| OKS Box | `oksbox` |
| OM Express | `omexpress` |
| On Time Express | `ontimeexpress` |
| One Express | `oneexpress` |
| Ovred | `ovred` |
| Packers | `packers` |
| PDEX | `pdex` |
| Prest | `prest` |
| Quick Delivery DZ | `quickdeliverydz` |
| RB Livraison | `rblivraison` |
| Red Ex | `redex` |
| Rex Livraison | `rexlivraison` |
| Rihal Express | `rihalexpress` |
| RJ 360 Express | `rj360express` |
| RM Express | `rmexpress` |
| Rocket Delivery | `rocketdelivery` |
| Royaume Delivery | `royaumedelivery` |
| RS Express | `rsexpress` |
| Ruta Express | `rutaexpress` |
| Salva Delivery | `salvadelivery` |
| Samex | `samex` |
| SBL Express | `sbl` |
| SI Express | `siexpress` |
| Speed Delivery | `speeddelivery` |
| Speed Mail | `speedmail` |
| Sultan Colis Express | `sultancolisexpress` |
| Swift Express | `swiftexpress` |
| Tawsil Star | `tawsilstar` |
| TSL Express | `tslexpress` |
| Ultra Express | `ultraexpress` |
| Univer Delivery | `univerdelivery` |
| Vitrans | `vitrans` |
| Wassim Express | `wassimexpress` |
| Wee Wee Delivery | `weeweedelivery` |
| Win Delivery | `windelivery` |
| WorldExpress | `worldexpress` |
| Zinya Tec | `zinyatec` |


## Ecotrack-specific behavior

- **Labels come back as PDF**: the label endpoint returns raw PDF bytes rather
  than a URL. dzship handles the difference; if you get a `labelUrl`, it's
  printable.
- **Status wording drifts per tenant**: each courier can customize status
  labels, so tenant A's "En livraison" can be tenant B's "Sorti en livraison".
  The known vocabulary maps to the [canonical statuses](../statuses.md); an
  unrecognized label comes through as `unknown` with `rawStatus` carrying the
  original text, so nothing is silently mislabeled.
- **Tracking lookups need care**: the underlying Ecotrack tracking API answers
  list-style queries, and a lazy "take the first row" client can attach the
  wrong parcel's status to your order. 
  exact tracking number. Worth knowing if you ever debug against the raw API.
- **No cancel endpoint**: cancel from the courier's dashboard.

## Which Ecotrack courier should I pick?

The platform is identical; the companies aren't. Delivered rate, pickup
punctuality and COD remittance speed vary by company and by region. Treat it
like the general 