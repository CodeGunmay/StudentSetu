// Renders StudentSetu screens and handles student actions.
import { useApp } from './context/AppContext';
import PhoneFrame from './ui/PhoneFrame';
import ToastHost from './ui/ToastHost';

import Splash from './screens/auth/Splash';
import Onboarding from './screens/auth/Onboarding';
import Login from './screens/auth/Login';
import Register from './screens/auth/Register';
import Verify from './screens/auth/Verify';
import Home from './screens/Home';
import Items from './screens/Items';
import ItemDetail from './screens/ItemDetail';
import ListItem from './screens/ListItem';
import Skills from './screens/Skills';
import Activity from './screens/Activity';
import Profile from './screens/Profile';

const SCREENS = {
  splash: Splash,
  onboarding: Onboarding,
  login: Login,
  register: Register,
  verify: Verify,
  home: Home,
  items: Items,
  item: ItemDetail,
  listItem: ListItem,
  skills: Skills,
  activity: Activity,
  profile: Profile,
};

const AUTH_SCREENS = ['splash', 'onboarding', 'login', 'register', 'verify'];

export default function App() {
  const { current, anim, user, toasts, dismissToast } = useApp();
  const name = SCREENS[current.name] ? current.name : 'home';
  const Screen = SCREENS[name];
  const isAuth = AUTH_SCREENS.includes(name);
  const showNav = !isAuth && !!user;

  const animClass =
    anim.dir === 'push' ? 'animate-slide-in' : anim.dir === 'pop' ? 'animate-slide-in-left' : 'animate-fade-up';

  return (
    <PhoneFrame statusTone={name === 'splash' || name === 'login' ? 'light' : 'dark'} showNav={showNav}>
      <main className={`relative h-full ${animClass}`} key={`${name}-${anim.key}`}>
        <Screen {...current.params} />
      </main>

      <ToastHost toasts={toasts} onDismiss={dismissToast} />
    </PhoneFrame>
  );
}
