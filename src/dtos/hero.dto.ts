export interface IHero {
  name: string;
  alias: string;
  slug: string;
  powers: string[];
  description: string;
  team: string;
  image: string;
  status: string;
  category: string;
  universe: string;
}

export interface IHeroPageResponse {
  total_pages: number;
  current_page: number;
  elements_per_page: number;
  total_elements: number;
  data: IHero[];
}
