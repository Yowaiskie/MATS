import { useMemo, useState, useEffect } from 'react';
import type { Step } from 'react-joyride';
import { useAuth } from '@/features/authentication/AuthContext';
import type { ModuleKey } from '@/types/auth';

export const useTutorialSteps = () => {
  const { hasModuleAccess } = useAuth();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const globalSteps = useMemo<Step[]>(() => {
    const p = isMobile ? '.mobile-tour-' : '.tour-';

    const steps: Step[] = [
      {
        target: 'body',
        content: 'Welcome sa MATS Portal! Tutulungan ka ng quick tour na \'to para ma-familiarize ka sa system. Pwede mong i-skip anytime kung gamay mo na.',
        title: 'Welcome to MATS!',
        placement: 'center',
      },
      {
        target: `${p}sidebar-menu`,
        content: 'Ito yung main navigation menu mo. Dito nakalista lahat ng modules na pwede mong ma-access based sa account role mo.',
        title: 'Main Menu',
        placement: isMobile ? 'center' : 'right',
      }
    ];

    if (hasModuleAccess('dashboard' as ModuleKey)) {
      steps.push({
        target: `${p}nav-dashboard`,
        content: 'Ang Dashboard ang main hub mo. Dito mo makikita yung summary ng data at recent activities para isang tinginan lang, updated ka na.',
        title: 'Dashboard Overview',
        placement: 'right',
      });
    }

    if (hasModuleAccess('schedules' as ModuleKey)) {
      steps.push({
        target: `${p}nav-schedules`,
        content: 'Sa Schedules, dito ka pwede mag-assign, mag-view, at mag-manage ng mga nakatakdang tungkulin ng members.',
        title: 'Schedule Management',
        placement: isMobile ? 'bottom' : 'right',
      });
    }

    if (hasModuleAccess('attendance' as ModuleKey)) {
      steps.push({
        target: `${p}nav-attendance`,
        content: 'Dito sa Attendance tini-track kung sino ang present o absent sa mga naka-schedule na activities.',
        title: 'Attendance Tracking',
        placement: isMobile ? 'bottom' : 'right',
      });
    }

    if (hasModuleAccess('members' as ModuleKey)) {
      steps.push({
        target: `${p}nav-members`,
        content: 'Ito yung directory ng lahat ng members. Pwede ka mag-add, edit, at i-manage yung details nila dito.',
        title: 'Members Directory',
        placement: isMobile ? 'bottom' : 'right',
      });
    }

    if (hasModuleAccess('events' as ModuleKey)) {
      steps.push({
        target: `${p}nav-events`,
        content: 'Ang Events module ay para sa mga special gatherings o activities outside the regular schedules.',
        title: 'Events Workspace',
        placement: isMobile ? 'bottom' : 'right',
      });
    }

    if (hasModuleAccess('finance' as ModuleKey)) {
      steps.push({
        target: `${p}nav-finance`,
        content: 'Para sa financial records, transactions, at reporting, dito mo yan makikita sa Finance module.',
        title: 'Finance Management',
        placement: isMobile ? 'bottom' : 'right',
      });
    }

    if (hasModuleAccess('reports' as ModuleKey)) {
      steps.push({
        target: `${p}nav-reports`,
        content: 'Kailangan ng summary data? Dito ka makaka-generate ng iba\'t ibang analytics at reports.',
        title: 'Reports & Analytics',
        placement: isMobile ? 'bottom' : 'right',
      });
    }

    if (hasModuleAccess('excuses' as ModuleKey)) {
      steps.push({
        target: `${p}nav-excuses`,
        content: 'Dito mo pwedeng i-review at i-approve yung mga excuse letters na sinubmit ng members natin.',
        title: 'Excuses Management',
        placement: isMobile ? 'bottom' : 'right',
      });
    }

    if (hasModuleAccess('users' as ModuleKey)) {
      steps.push({
        target: `${p}nav-users`,
        content: 'Pang-admin lang ito: Dito nagma-manage ng system accounts, roles, at permissions ng bawat user.',
        title: 'User Management',
        placement: isMobile ? 'bottom' : 'right',
      });
    }

    if (hasModuleAccess('settings' as ModuleKey)) {
      steps.push({
        target: `${p}nav-settings`,
        content: 'Dito mo mako-configure yung global system settings, preferences, at mga default values ng app.',
        title: 'System Settings',
        placement: isMobile ? 'bottom' : 'right',
      });
    }

    if (hasModuleAccess('audit' as ModuleKey)) {
      steps.push({
        target: `${p}nav-audit`,
        content: 'Gusto mong makita sino gumawa ng specific action? Nasa Audit Trail nakatago lahat ng logs at system activities.',
        title: 'Audit Trail',
        placement: isMobile ? 'bottom' : 'right',
      });
    }

    if (hasModuleAccess('changePassword' as ModuleKey)) {
      steps.push({
        target: `${p}nav-changePassword`,
        content: 'Kung kailangan mong i-update yung password mo, dito ka dapat pumunta para secure ang account mo.',
        title: 'Change Password',
        placement: isMobile ? 'bottom' : 'right',
      });
    }

    steps.push({
      target: `${p}user-menu`,
      content: 'At dito sa baba, makikita mo yung profile info mo at ang Sign Out section.',
      title: 'User Profile',
      placement: isMobile ? 'top' : 'right',
    });

    steps.push({
      target: 'body',
      content: 'Ayan, tapos na ang tour! Handa ka na gamitin ang system. Welcome sa MATS Portal and have a great day!',
      title: "You're all set! 🎉",
      placement: 'center',
    });

    return steps;
  }, [hasModuleAccess]);

  return { globalSteps };
};
