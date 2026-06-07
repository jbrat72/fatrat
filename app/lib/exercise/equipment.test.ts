import { describe, it, expect } from 'vitest';
import { getEquipmentProfiles, defaultProfileId, itemsForProfile } from './equipment';
import type { UserProfile } from '@/types';

const base = { equipment: ['home-gym'] } as Pick<UserProfile, 'equipment' | 'equipmentItems' | 'equipmentProfiles' | 'defaultEquipmentProfileId'>;

describe('equipment profiles', () => {
  it('migrates a legacy single list into one default profile', () => {
    const u = { ...base, equipmentItems: ['Pull-Up Bar'] };
    const ps = getEquipmentProfiles(u);
    expect(ps.length).toBe(1);
    expect(ps[0].items).toContain('Pull-Up Bar');
    expect(defaultProfileId(u)).toBe(ps[0].id);
  });

  it('resolves items for a chosen profile, falling back to default', () => {
    const u = {
      ...base,
      equipmentProfiles: [
        { id: 'home', name: 'Home', items: ['Dumbbells — Adjustable'] },
        { id: 'gym', name: 'Gym', items: ['Barbell & Plates', 'Power / Squat Rack'] },
      ],
      defaultEquipmentProfileId: 'home',
    };
    expect(itemsForProfile(u, 'gym')).toContain('Barbell & Plates');
    expect(itemsForProfile(u, 'home')).toContain('Dumbbells — Adjustable');
    expect(itemsForProfile(u, 'nonexistent')).toEqual(['Dumbbells — Adjustable']); // -> default
  });
});
