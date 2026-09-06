import React, { createContext, useState, useContext } from 'react';

type Language = 'en' | 'fr';

const translations = {
  en: {
    whereTo: 'Where to in Yaoundé?',
    requestRide: 'Request Private Ride',
    requestShareable: 'Request Shareable Ride',
    voluntaryShare: 'Voluntary Dynamic Share',
    save40: 'Save up to 40%',
    selectCategory: 'Select Category',
    privateRide: 'Private Ride',
    voluntaryShareTab: 'Voluntary Share',
    riderMode: 'Rider',
    driverMode: 'Driver',
    home: 'Home',
    rides: 'Rides',
    places: 'Places',
    notifications: 'Notifications',
    profile: 'Profile',
    requests: 'Requests',
    earnings: 'Earnings',
    analytics: 'Analytics',
    logout: 'Log Out',
    mvanToBastos: 'Mvan ➔ Bastos',
    mokoloToBiyem: 'Mokolo ➔ Biyem-Assi',
    estimatedSoloFare: 'Estimated Private Fare',
    estimatedSharedFare: 'Estimated Shared Fare',
    joinShared: 'Join Shared Ride',
    noMatch: 'No passenger currently on route',
    makeShareableSub: 'Create your ride and make it shareable for future passengers to join!',
    driverWelcome: 'Good evening',
    youAreOnline: 'YOU ARE ONLINE',
    youAreOffline: 'YOU ARE OFFLINE',
    demandNearYou: 'Demand Near You',
    goOnline: 'Go Online Now',
    goOffline: 'Go Offline',
    availableBalance: 'Available Balance',
    netEarning: 'Net Earning',
    commission: 'Platform Commission (15%)',
    submitWithdrawal: 'Submit Withdrawal Request',
    personalAdvice: 'Personalized Routine Advice',
    highDemandZones: 'High Demand Zones (Yaoundé)',
    cashPinTitle: 'Cash Payment 4-Digit PIN',
    givePinSub: 'Give this code to your driver upon cash handover:',
    confirmCash: 'Confirm Cash',
    cashConfirmed: 'Cash Payment Confirmed',
    savedFavorites: 'Saved Favorites',
    safetySos: 'SOS Emergency Signal',
    loyalPoints: 'Loyalty Points',
    discoverPlaces: 'Discover Popular Places',
  },
  fr: {
    whereTo: 'Où allez-vous à Yaoundé ?',
    requestRide: 'Commander une course privée',
    requestShareable: 'Commander une course partagée',
    voluntaryShare: 'Covoiturage Dynamique Volontaire',
    save40: 'Économisez jusqu’à 40%',
    selectCategory: 'Choisir la Catégorie',
    privateRide: 'Course Privée',
    voluntaryShareTab: 'Covoiturage Volontaire',
    riderMode: 'Passager',
    driverMode: 'Chauffeur',
    home: 'Accueil',
    rides: 'Courses',
    places: 'Lieux',
    notifications: 'Notifications',
    profile: 'Profil',
    requests: 'Demandes',
    earnings: 'Gains',
    analytics: 'Analytique IA',
    logout: 'Déconnexion',
    mvanToBastos: 'Mvan ➔ Bastos',
    mokoloToBiyem: 'Mokolo ➔ Biyem-Assi',
    estimatedSoloFare: 'Tarif Privé Estimé',
    estimatedSharedFare: 'Tarif Partagé Estimé',
    joinShared: 'Rejoindre le Covoiturage',
    noMatch: 'Aucun passager sur ce trajet actuellement',
    makeShareableSub: 'Créez votre course et rendez-la partagée pour que d’autres passagers vous rejoignent !',
    driverWelcome: 'Bonsoir',
    youAreOnline: 'VOUS ÊTES EN LIGNE',
    youAreOffline: 'VOUS ÊTES HORS LIGNE',
    demandNearYou: 'Demande à Proximité',
    goOnline: 'Passer en Ligne',
    goOffline: 'Passer Hors Ligne',
    availableBalance: 'Solde Disponible',
    netEarning: 'Gains Nets',
    commission: 'Commission Plateforme (15%)',
    submitWithdrawal: 'Demander un Retrait',
    personalAdvice: 'Conseil de Routine Personnalisé',
    highDemandZones: 'Zones à Forte Demande (Yaoundé)',
    cashPinTitle: 'Code PIN à 4 Chiffres (Paiement Espèces)',
    givePinSub: 'Donnez ce code PIN à votre chauffeur lors de la remise des espèces :',
    confirmCash: 'Confirmer Espèces',
    cashConfirmed: 'Paiement Espèces Confirmé',
    savedFavorites: 'Lieux Favoris',
    safetySos: 'Signal d’Urgence SOS',
    loyalPoints: 'Points de Fidélité',
    discoverPlaces: 'Découvrir des Lieux Populaires',
  },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: keyof typeof translations['en']) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('en');

  const t = (key: keyof typeof translations['en']) => {
    return translations[language][key] || translations['en'][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
};
