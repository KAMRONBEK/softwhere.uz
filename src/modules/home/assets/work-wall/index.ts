import type { StaticImageData } from 'next/image';
import agrobankFresh from './agrobank-fresh.webp';
import aiMerch from './ai-merch.webp';
import align360 from './align-360.webp';
import ascon from './ascon.webp';
import asiaInsurance from './asia-insurance.webp';
import avtogen from './avtogen.webp';
import bdm from './bdm.webp';
import birmakon from './birmakon.webp';
import brainwake from './brainwake.webp';
import brandGuard from './brand-guard.webp';
import businessgov from './businessgov.webp';
import bysmillah from './bysmillah.webp';
import challengeEi from './challenge-ei.webp';
import chatApp from './chat-app.webp';
import driveme from './driveme.webp';
import edocs from './edocs.webp';
import emitAutolab from './emit-autolab.webp';
import express100k from './express-100k.webp';
import fullTaxi from './full-taxi.webp';
import hamd from './hamd.webp';
import haruConsole from './haru-console.webp';
import helloBox from './hello-box.webp';
import heyall from './heyall.webp';
import ipakYuliLocator from './ipak-yuli-locator.webp';
import kiber from './kiber.webp';
import litterPicking from './litter-picking.webp';
import livemysteps from './livemysteps.webp';
import medrite from './medrite.webp';
import myBarber from './my-barber.webp';
import mydesign from './mydesign.webp';
import naft from './naft.webp';
import nestegg from './nestegg.webp';
import netevia from './netevia.webp';
import nexus from './nexus.webp';
import novalinqEld from './novalinq-eld.webp';
import ossSdks from './oss-sdks.webp';
import persona from './persona.webp';
import primusMall from './primus-mall.webp';
import pulse from './pulse.webp';
import seyfBazar from './seyf-bazar.webp';
import snapTaxi from './snap-taxi.webp';
import stadiumPeople from './stadium-people.webp';
import swish from './swish.webp';
import talimAi from './talim-ai.webp';
import tesChat from './tes-chat.webp';
import tesTube from './tes-tube.webp';
import truckMe from './truck-me.webp';
import unitedFuel from './united-fuel.webp';
import vbrato from './vbrato.webp';
import voltai from './voltai.webp';
import whoriddle from './whoriddle.webp';
import workaxle from './workaxle.webp';
import zenoLearning from './zeno-learning.webp';
import zpay from './zpay.webp';

/**
 * 640x360 WebP stills (~13 KB each), one per walkthrough: the full frame at
 * the tile's still time (tiles/index.ts `stillTime`, the first app slide).
 * The lightbox shows it until its video plays, so its zoom out of a tile
 * starts on the very picture the tile showed (the poster .jpg is the title card).
 * Regenerate: ffmpeg -ss <stillTime> -i <slug>.mp4 -frames:v 1 -vf scale=640:360 -c:v libwebp -quality 68 <slug>.webp
 */
export const WORK_WALL_THUMBS: Readonly<Record<string, StaticImageData>> = {
  'agrobank-fresh': agrobankFresh,
  'ai-merch': aiMerch,
  'align-360': align360,
  ascon,
  'asia-insurance': asiaInsurance,
  avtogen,
  bdm,
  birmakon,
  brainwake,
  'brand-guard': brandGuard,
  businessgov,
  bysmillah,
  'challenge-ei': challengeEi,
  'chat-app': chatApp,
  driveme,
  edocs,
  'emit-autolab': emitAutolab,
  'express-100k': express100k,
  'full-taxi': fullTaxi,
  hamd,
  'haru-console': haruConsole,
  'hello-box': helloBox,
  heyall,
  'ipak-yuli-locator': ipakYuliLocator,
  kiber,
  'litter-picking': litterPicking,
  livemysteps,
  medrite,
  'my-barber': myBarber,
  mydesign,
  naft,
  nestegg,
  netevia,
  nexus,
  'novalinq-eld': novalinqEld,
  'oss-sdks': ossSdks,
  persona,
  'primus-mall': primusMall,
  pulse,
  'seyf-bazar': seyfBazar,
  'snap-taxi': snapTaxi,
  'stadium-people': stadiumPeople,
  swish,
  'talim-ai': talimAi,
  'tes-chat': tesChat,
  'tes-tube': tesTube,
  'truck-me': truckMe,
  'united-fuel': unitedFuel,
  vbrato,
  voltai,
  whoriddle,
  workaxle,
  'zeno-learning': zenoLearning,
  zpay,
};
