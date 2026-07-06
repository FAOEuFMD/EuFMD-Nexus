"""
THRACE Freedom Model Calculator
Implements Cameron et al. (FAO 2014) combined herd sensitivity with overlap correction
Replaces: thrace.get_freedom_data() SQL function
Corrections Implemented: R1, R2, R4, R7, R11-R15
"""

import math
import json
from datetime import datetime, date
from typing import Dict, List, Optional, Tuple, Union
from sqlalchemy import text
from sqlalchemy.engine import Engine


def parse_inspection_date(value: Union[datetime, date, str, None]) -> Optional[datetime]:
    """Normalize dt_insp from DB rows (datetime, date, or ISO string)."""
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, date):
        return datetime(value.year, value.month, value.day)
    if isinstance(value, str):
        raw = value.strip()
        for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
            try:
                return datetime.strptime(raw, fmt)
            except ValueError:
                continue
        try:
            return datetime.fromisoformat(raw.replace("Z", "+00:00")[:19])
        except ValueError:
            return None
    return None


class ThraceCalculator:
    """
    Calculates system sensitivity and probability of freedom for THRACE surveillance model.
    Reads pre-aggregated thrace.all_data (same source as legacy get_freedom_data SQL).
    """

    # all_data uses 'pigs'; calculator filters use 'pig'
    SPECIES_ALL_DATA = {
        'cattle': 'cattle',
        'buffalo': 'buffalo',
        'sheep': 'sheep',
        'goat': 'goat',
        'pig': 'pigs',
    }
    
    def __init__(self, db_engine: Engine):
        self.db = db_engine
    
    # =========================================================================
    # PARAMETER HANDLING
    # =========================================================================
    
    def get_params(self, disease: str, region: str) -> Dict[str, float]:
        """
        Get all parameters for a disease/region combination.
        Replaces: thrace.get_param() SQL function
        Correction R7: Returns DOUBLE (Python float is double precision)
        """
        with self.db.connect() as conn:
            result = conn.execute(text("""
                SELECT param, value 
                FROM thrace.params 
                WHERE disease = :disease AND region = :region
            """), {"disease": disease, "region": region})
            
            params = {row.param: float(row.value) for row in result}
            
            # Fallback to region-wide params if country-specific not found
            if not params and ',' in region:
                result = conn.execute(text("""
                    SELECT param, value 
                    FROM thrace.params 
                    WHERE disease = :disease AND region = :region
                """), {"disease": disease, "region": region})
                params = {row.param: float(row.value) for row in result}
        
        return params
    
    def calculate_adjusted_risk(self, params: Dict[str, float]) -> Dict[str, float]:
        """
        Calculate adjusted risk values (high and low).
        Formula: AdjRisk = RR / ((RR_high * PrP_high) + (RR_low * (1 - PrP_high)))
        """
        rr_high = params.get('RR_high', 3.0)
        rr_low = params.get('RR_low', 1.0)
        prp_high = params.get('PrP_high', 0.2)
        
        denominator = (rr_high * prp_high) + (rr_low * (1 - prp_high))
        
        if denominator == 0:
            return {'high': 1.0, 'low': 1.0}
        
        return {
            'high': rr_high / denominator,
            'low': rr_low / denominator
        }
    
    # =========================================================================
    # PROTOCOL RULES (R2 - Tested vs Examined)
    # =========================================================================
    
    def get_tested_count(
        self, 
        species: str, 
        disease: str, 
        country: str, 
        exam_count: int, 
        tested_count: Optional[int],
        visit_date: datetime
    ) -> int:
        """
        R2: Determine actual tested count based on protocol rules.
        
        Priority:
        1. If user provided tested_count (from Excel), use it
        2. Otherwise, apply protocol rules from Corrections Doc Section 1
        """
        # If user provided explicit tested count, use it
        if tested_count is not None and tested_count > 0:
            return tested_count

        visit_dt = parse_inspection_date(visit_date)
        
        # Default: Tested = Examined (covers FMD and most cases)
        effective_tested = exam_count if exam_count else 0
        
        # Protocol Exceptions (Corrections Doc Section 1 table)
        if disease == 'PPR':
            if country == 'GRC':
                visit_date_obj = visit_dt.date() if visit_dt else None
                if visit_date_obj and visit_date_obj < datetime(2024, 7, 1).date():
                    # Greece PPR before July 2024: 1/4 tested
                    effective_tested = int(exam_count * 0.25) if exam_count else 0
                # else: all tested (default)
            elif country == 'TUR':
                # Türkiye PPR: Not tested
                effective_tested = 0
        
        elif disease in ['LSD', 'SGP']:
            if country in ['GRC', 'BGR', 'TUR']:
                # LSD/SGP in GR/BG/TR: Not clinically tested
                effective_tested = 0
        
        return effective_tested
    
    # =========================================================================
    # SENSITIVITY CALCULATIONS (R1 - Combined Herd Sensitivity)
    # =========================================================================
    
    def calculate_herd_sensitivity_component(
        self, 
        sample_count: int, 
        population: int, 
        unit_sensitivity: float,
        design_prevalence_animal: float
    ) -> float:
        """
        Calculate herd sensitivity for one component (clinical OR serological).
        
        Formula: SeH = 1 - (1 - SeU * n/N)^(N * P*A)
        
        Where:
        - SeU = Unit sensitivity (USe_1 for clinical, USe_2 for serological)
        - n = Number tested
        - N = Population size
        - P*A = Animal-level design prevalence
        """
        if population == 0 or sample_count == 0 or unit_sensitivity == 0:
            return 0.0
        
        # Effective sample size based on design prevalence
        n_effective = math.ceil(population * design_prevalence_animal)
        
        # Probability of not detecting infection in one animal
        prob_not_detect_single = 1 - (unit_sensitivity * sample_count / population)
        
        # Probability of not detecting infection in the herd
        if prob_not_detect_single <= 0:
            return 1.0
        
        prob_not_detect_herd = prob_not_detect_single ** n_effective
        
        return 1 - prob_not_detect_herd
    
    def calculate_combined_herd_sensitivity_R1(
        self,
        clin_examined: int,
        clin_tested: int,
        sero_sampled: int,
        population: int,
        params: Dict[str, float],
        risk_level: str
    ) -> float:
        """
        R1: Combined herd sensitivity with overlap correction.
        Following Cameron et al. (FAO 2014), p.147 sequential component approach.
        
        Steps:
        1. Calculate Component 1 (clinical) sensitivity
        2. Calculate posterior probability infected after Component 1
        3. Calculate Component 2 (serological) sensitivity with updated prior
        4. Combine both components accounting for overlap
        
        This corrects the old SQL which assumed independence between components.
        """
        # Parameters (CRITICAL: USe_1 is SERO, USe_2 is CLIN based on SQL line 619-620)
        use_sero = params.get('USe_1', 0.92)  # Serological test sensitivity
        use_clin = params.get('USe_2', 0.2)   # Clinical examination sensitivity
        pstar_h = params.get('PstarH', 0.02)  # Herd-level design prevalence
        pstar_a = params.get('PstarA', 0.2)   # Animal-level design prevalence
        
        # Adjusted risk (high or low)
        adj_risk = self.calculate_adjusted_risk(params).get(risk_level, 1.0)
        
        # Prior probability of infection
        p_infected_prior = pstar_h * adj_risk
        
        # Calculate effective sample size (number of infected animals to detect)
        n_effective = math.ceil(population * pstar_a)
        
        #  ========== SQL FORMULA (lines 619-620) ==========
        # HSe = 1 - (1-(USe_1*sero/size))^n * (1-(USe_2*clin/size))^n
        # This ASSUMES INDEPENDENCE between sero and clin (NOT Cameron sequential)
        
        if population == 0:
            return 0.0
        
        # Term 1: Serological component
        if sero_sampled > 0:
            prob_not_detect_sero = 1 - (use_sero * sero_sampled / population)
            if prob_not_detect_sero > 0:
                term1 = prob_not_detect_sero ** n_effective
            else:
                term1 = 0.0
        else:
            term1 = 1.0  # No serology = no detection via serology
        
        # Term 2: Clinical component
        if clin_tested > 0:
            prob_not_detect_clin = 1 - (use_clin * clin_tested / population)
            if prob_not_detect_clin > 0:
                term2 = prob_not_detect_clin ** n_effective
            else:
                term2 = 0.0
        else:
            term2 = 1.0  # No clinical = no detection via clinical
        
        # Combined: multiply the "not detect" probabilities (independence assumption)
        hse = 1 - (term1 * term2)
        
        return max(0.0, min(1.0, hse))
    
    # =========================================================================
    # DATA RETRIEVAL
    # =========================================================================
    
    def ensure_all_data(self, refresh: bool = False) -> None:
        """Build or refresh thrace.all_data summary table (legacy create_data_summary)."""
        if not refresh:
            with self.db.connect() as conn:
                count_row = conn.execute(text("""
                    SELECT COUNT(*) AS cnt
                    FROM information_schema.tables
                    WHERE table_schema = 'thrace' AND table_name = 'all_data'
                """)).fetchone()
                if count_row and count_row.cnt:
                    data_count = conn.execute(text("SELECT COUNT(*) AS cnt FROM thrace.all_data")).fetchone()
                    if data_count and data_count.cnt > 0:
                        return
        with self.db.begin() as conn:
            conn.execute(text("CALL thrace.create_data_summary()"))

    def get_all_data_rows(
        self,
        countries: List[str],
        disease: str,
        species_list: List[str],
    ) -> List[Dict]:
        """Load pre-aggregated rows from thrace.all_data for all years."""
        all_data_species = [
            self.SPECIES_ALL_DATA.get(s, s) for s in species_list
        ]
        with self.db.connect() as conn:
            result = conn.execute(text("""
                SELECT year, month, country, risk, size, sero, clin
                FROM thrace.all_data
                WHERE disease = :disease
                  AND country IN :countries
                  AND species IN :species
                  AND year > 2015 AND year < 2050
                  AND size > 0
            """), {
                "disease": disease,
                "countries": tuple(countries),
                "species": tuple(all_data_species),
            })
            return [dict(row._mapping) for row in result]

    def load_monthly_pintro_cache(self) -> Dict[Tuple[Optional[int], int], float]:
        """Load all monthly P(intro) values in one query."""
        cache: Dict[Tuple[Optional[int], int], float] = {}
        with self.db.connect() as conn:
            for row in conn.execute(text(
                "SELECT year, month, pintro FROM thrace.monthly_pintro"
            )):
                cache[(row.year, row.month)] = (
                    float(row.pintro) if row.pintro is not None else 0.0167
                )
        return cache

    @staticmethod
    def lookup_pintro(
        cache: Dict[Tuple[Optional[int], int], float],
        year: int,
        month: int,
    ) -> float:
        if (year, month) in cache:
            return cache[(year, month)]
        if (None, month) in cache:
            return cache[(None, month)]
        return 0.0167
    
    # =========================================================================
    # MAIN CALCULATION
    # =========================================================================
    
    def calculate_system_sensitivity(
        self,
        species_filter: str,
        disease: str,
        region_filter: str,
        refresh_summary: bool = False,
    ) -> Dict:
        """
        Main calculation — all years from thrace.all_data (matches legacy SQL).
        """
        # Map species filter to list
        species_map = {
            'ALL': ['cattle', 'buffalo', 'sheep', 'goat', 'pig'],
            'LR': ['cattle', 'buffalo'],
            'BOV': ['cattle'],
            'BUF': ['buffalo'],
            'SR': ['sheep', 'goat'],
            'OVI': ['sheep'],
            'CAP': ['goat'],
            'POR': ['pig']
        }
        species_list = species_map.get(species_filter, species_map['ALL'])
        
        # Map region filter to country codes
        region_map = {
            'ALL': ['GRC', 'BGR', 'TUR'],
            'GR': ['GRC'],
            'BG': ['BGR'],
            'TK': ['TUR']
        }
        countries = region_map.get(region_filter, region_map['ALL'])
        
        # Get parameters
        region_param = ','.join(countries) if len(countries) > 1 else countries[0]
        params = self.get_params(disease, region_param)
        
        # Special handling for Greece (R14: RR=1)
        if 'GRC' in countries and len(countries) == 1:
            params['RR_high'] = 1.0
            params['RR_low'] = 1.0
        
        # Ensure summary table exists / refresh if requested
        self.ensure_all_data(refresh=refresh_summary)

        # Get pre-aggregated data (all years)
        rows = self.get_all_data_rows(countries, disease, species_list)
        pintro_cache = self.load_monthly_pintro_cache()

        # Group by year-month
        monthly_data: Dict[Tuple[int, int], List[Dict]] = {}
        for row in rows:
            month_key = (int(row['year']), int(row['month']))
            monthly_data.setdefault(month_key, []).append(row)

        adj_risk = self.calculate_adjusted_risk(params)
        pstar_h = params.get('PstarH', 0.02)

        # Calculate monthly sensitivity
        results = []
        p_free = 0.5  # Initial prior probability of freedom

        for (year, month) in sorted(monthly_data.keys()):
            month_rows = monthly_data[(year, month)]

            prod_high = 1.0
            prod_low = 1.0
            total_animals = 0
            total_herds = len(month_rows)
            total_sero = 0
            total_clin = 0

            for row in month_rows:
                size = int(row.get('size') or 0)
                clin = int(row.get('clin') or 0)
                sero = int(row.get('sero') or 0)
                if size == 0:
                    continue

                total_animals += size
                total_sero += sero
                total_clin += clin

                risk_level = (row.get('risk') or 'high').lower()

                hse = self.calculate_combined_herd_sensitivity_R1(
                    clin_examined=clin,
                    clin_tested=clin,
                    sero_sampled=sero,
                    population=size,
                    params=params,
                    risk_level=risk_level,
                )

                if hse <= 0:
                    continue

                adj = adj_risk['high'] if risk_level == 'high' else adj_risk['low']
                term = adj * pstar_h * hse
                if risk_level == 'high':
                    prod_high *= (1 - term)
                else:
                    prod_low *= (1 - term)

            sse = 1 - (prod_high * prod_low)

            pintro = self.lookup_pintro(pintro_cache, year, month)
            
            # Bayesian update for P(Free)
            # P(Free|neg) = ((1-PIntro) * P(Free)) / (1 - SSe + (P(Free) * SSe))
            if sse < 1.0:
                numerator = (1 - pintro) * p_free
                denominator = 1 - sse + (p_free * sse)
                p_free = numerator / denominator if denominator > 0 else 0.0
            else:
                p_free = 0.0
            
            results.append({
                'mth': f"{year}-{str(month).zfill(2)}-01",
                'year': year,
                'month': month,
                'sse': round(sse, 6),
                'pintro': round(pintro, 6),
                'posterior': round(p_free, 4),
                'animals': total_animals,
                'herds': total_herds,
                'sero': total_sero,
                'clin': total_clin
            })
        
        # Format output to match old get_freedom_data JSON structure
        return {
            'labels': [r['mth'] for r in results],
            'pfree': [str(r['posterior']) for r in results],
            'sens': [str(r['sse']) for r in results],
            'pintro': [str(r['pintro']) for r in results],
            'animals': [r['animals'] for r in results],
            'herds': [r['herds'] for r in results],
            'sero': [r['sero'] for r in results],
            'clin': [r['clin'] for r in results]
        }
    
    # =========================================================================
    # UTILITY METHODS
    # =========================================================================
    
    def save_calculation_results(
        self, 
        results: Dict, 
        species_filter: str, 
        disease: str, 
        region_filter: str, 
        user_id: int = None
    ):
        """
        R24: Save calculation results to permanent table for audit trail
        
        Args:
            results: Output from calculate_system_sensitivity()
            species_filter: Species filter used (BOV, SR, ALL, etc.)
            disease: Disease type (FMD, PPR, LSD, SGP)
            region_filter: Region filter (GR, BG, TK, ALL)
            user_id: ID of user who ran calculation
        """
        with self.db.begin() as conn:
            # Extract arrays from results
            labels = results.get('labels', [])
            pfree = results.get('pfree', [])
            sens = results.get('sens', [])
            pintro = results.get('pintro', [])
            animals = results.get('animals', [])
            herds = results.get('herds', [])
            sero = results.get('sero', [])
            clin = results.get('clin', [])
            
            # Insert each month's results
            for i in range(len(labels)):
                # Parse year and month from label (format: YYYY-MM-01)
                label_parts = labels[i].split('-')
                result_year = int(label_parts[0])
                result_month = int(label_parts[1])
                
                conn.execute(text("""
                    INSERT INTO thrace.thrace_calculation_results (
                        species_filter, disease, region_filter,
                        result_year, result_month, sse, pintro, pfreedom,
                        animals, herds, sero_samples, clin_examined,
                        calculated_by, calculation_version, calculated_at
                    ) VALUES (
                        :species_filter, :disease, :region_filter,
                        :result_year, :result_month, :sse, :pintro, :pfreedom,
                        :animals, :herds, :sero, :clin, :user_id, :version, NOW()
                    )
                """), {
                    "species_filter": species_filter,
                    "disease": disease,
                    "region_filter": region_filter,
                    "result_year": result_year,
                    "result_month": result_month,
                    "sse": float(sens[i]) if sens[i] else 0.0,
                    "pintro": float(pintro[i]) if pintro[i] else 0.0,
                    "pfreedom": float(pfree[i]) if pfree[i] else 0.0,
                    "animals": animals[i] if i < len(animals) else 0,
                    "herds": herds[i] if i < len(herds) else 0,
                    "sero": sero[i] if i < len(sero) else 0,
                    "clin": clin[i] if i < len(clin) else 0,
                    "user_id": user_id,
                    "version": "v2.0_python"
                })
    
    def validate_calculation(
        self, 
        species_filter: str, 
        disease: str, 
        region_filter: str, 
    ) -> Dict:
        """Validation helper - returns intermediate values for debugging."""
        results = self.calculate_system_sensitivity(
            species_filter, disease, region_filter
        )
        
        return {
            'calculation_results': results,
            'parameters_used': self.get_params(
                disease, 
                ','.join(['GRC', 'BGR', 'TUR'])
            ),
            'adjusted_risks': self.calculate_adjusted_risk(
                self.get_params(disease, ','.join(['GRC', 'BGR', 'TUR']))
            )
        }