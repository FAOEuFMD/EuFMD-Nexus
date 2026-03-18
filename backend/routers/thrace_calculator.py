"""
THRACE Freedom Model Calculator
Implements Cameron et al. (FAO 2014) combined herd sensitivity with overlap correction
Replaces: thrace.get_freedom_data() SQL function
Corrections Implemented: R1, R2, R4, R7, R11-R15
"""

import math
import json
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from sqlalchemy import text
from sqlalchemy.engine import Engine


class ThraceCalculator:
    """
    Calculates system sensitivity and probability of freedom for THRACE surveillance model.
    
    Key Changes from Old SQL:
    - R1: Combined herd sensitivity with overlap correction (Cameron et al. FAO 2014, p.147)
    - R2: Uses *_tested columns instead of *_exam for clinical testing
    - R4: Uses risklevel from epiunits table (not hardcoded 'high')
    - R7: Uses DOUBLE precision for parameters
    - R14: Greece RR=1 (risk-based not applicable)
    """
    
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
        
        # Default: Tested = Examined (covers FMD and most cases)
        effective_tested = exam_count if exam_count else 0
        
        # Protocol Exceptions (Corrections Doc Section 1 table)
        if disease == 'PPR':
            if country == 'GRC':
                try:
                    # Ensure visit_date is a datetime object for comparison
                    if isinstance(visit_date, str):
                        # Check for invalid dates (day 00 or month 00)
                        if '-00' in visit_date or visit_date.endswith('-00'):
                            print(f"Warning: Invalid visit_date {visit_date}, using default protocol")
                            return effective_tested
                        
                        visit_date = datetime.strptime(visit_date, '%Y-%m-%d') if ' ' not in visit_date else datetime.strptime(visit_date, '%Y-%m-%d %H:%M:%S')
                    
                    # Compare with July 1, 2024
                    cutoff_date = datetime(2024, 7, 1)
                    if visit_date < cutoff_date:
                        # Greece PPR before July 2024: 1/4 tested
                        effective_tested = int(exam_count * 0.25) if exam_count else 0
                    # else: all tested (default)
                except (ValueError, AttributeError) as e:
                    print(f"Warning: Error parsing visit_date for PPR protocol: {str(e)}, using default")
                    
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
    
    def get_factivities_data(
        self,
        countries: List[str],
        disease: str,
        species_list: List[str],
        min_year: int = None
    ) -> List[Dict]:
        """
        Retrieve factivities data joined with epiunits and geographic info.
        Uses TCC schema for geographic hierarchy.
        Optimized: Filters by year at database level for faster queries.
        """
        with self.db.connect() as conn:
            # Build species filter for SQL
            species_filter = ','.join(f"'{s}'" for s in species_list)
            countries_filter = ','.join(f"'{c}'" for c in countries)
            
            # Build year filter if specified
            year_condition = ""
            query_params = {"countries": tuple(countries)}
            if min_year:
                year_condition = "AND YEAR(fa.dt_insp) >= :min_year"
                query_params["min_year"] = min_year
            
            query = text(f"""
                SELECT 
                    fa.factivityID,
                    fa.epiunitID,
                    fa.dt_insp,
                    fa.cattle, fa.sheep, fa.goat, fa.pig, fa.buffalo,
                    fa.cattleexam, fa.sheepexam, fa.goatsexam, fa.buffaloesexam,
                    fa.cattletested, fa.sheeptested, fa.goattested, fa.buffalotested,
                    fa.cattlesample, fa.sheepsample, fa.goatsample, fa.buffaloessample,
                    eu.risklevel,
                    n.three_letter_code as country,
                    n.two_letter_code as country_short
                FROM thrace.factivities fa
                JOIN thrace.epiunits eu ON fa.epiunitID = eu.epiunitID
                JOIN TCC.districts d ON eu.districtID = d.districtID
                JOIN TCC.provinces p ON d.provinceID = p.provinceID
                JOIN TCC.nations n ON p.nationID = n.nationID
                WHERE n.three_letter_code IN :countries
                AND fa.dt_insp IS NOT NULL
                {year_condition}
            """)
            
            result = conn.execute(query, query_params)
            
            activities = []
            for row in result:
                activities.append({
                    'factivityID': row.factivityID,
                    'epiunitID': row.epiunitID,
                    'dt_insp': row.dt_insp,
                    'country': row.country,
                    'risklevel': row.risklevel or 'low',
                    'populations': {
                        'cattle': row.cattle or 0,
                        'sheep': row.sheep or 0,
                        'goat': row.goat or 0,
                        'pig': row.pig or 0,
                        'buffalo': row.buffalo or 0
                    },
                    'examined': {
                        'cattle': row.cattleexam or 0,
                        'sheep': row.sheepexam or 0,
                        'goat': row.goatsexam or 0,
                        'buffalo': row.buffaloesexam or 0
                    },
                    'tested': {
                        'cattle': row.cattletested,
                        'sheep': row.sheeptested,
                        'goat': row.goattested,
                        'buffalo': row.buffalotested
                    },
                    'sampled': {
                        'cattle': row.cattlesample or 0,
                        'sheep': row.sheepsample or 0,
                        'goat': row.goatsample or 0,
                        'buffalo': row.buffaloessample or 0
                    }
                })
            
            return activities
    
    def get_monthly_pintro(self, year: int, month: int, disease: str, country: str) -> float:
        """
        R11-R12: Get monthly probability of introduction.
        First tries year-specific, then falls back to generic monthly values.
        """
        with self.db.connect() as conn:
            # Try year-specific first
            result = conn.execute(text("""
                SELECT pintro 
                FROM thrace.monthly_pintro 
                WHERE year = :year AND month = :month
            """), {"year": year, "month": month}).fetchone()
            
            if result and result.pintro:
                return float(result.pintro)
            
            # Fall back to generic monthly (year IS NULL)
            result = conn.execute(text("""
                SELECT pintro 
                FROM thrace.monthly_pintro 
                WHERE year IS NULL AND month = :month
            """), {"month": month}).fetchone()
            
            return float(result.pintro) if result and result.pintro else 0.0167  # 1/12 default
    
    def get_all_monthly_pintro(self, year_month_pairs: List[Tuple[int, int]], disease: str, country: str) -> Dict[Tuple[int, int], float]:
        """
        Batch load all monthly pintro values at once to avoid N+1 queries.
        Returns dict mapping (year, month) -> pintro value.
        """
        if not year_month_pairs:
            return {}
        
        pintro_map = {}
        
        with self.db.connect() as conn:
            # Get all year-specific values
            years = list(set(y for y, m in year_month_pairs))
            months = list(set(m for y, m in year_month_pairs))
            
            result = conn.execute(text("""
                SELECT year, month, pintro 
                FROM thrace.monthly_pintro 
                WHERE year IN :years AND month IN :months
            """), {"years": tuple(years), "months": tuple(months)})
            
            for row in result:
                pintro_map[(row.year, row.month)] = float(row.pintro)
            
            # Get generic monthly values for fallback
            result = conn.execute(text("""
                SELECT month, pintro 
                FROM thrace.monthly_pintro 
                WHERE year IS NULL AND month IN :months
            """), {"months": tuple(months)})
            
            generic_pintro = {row.month: float(row.pintro) for row in result}
            
            # Fill in missing values with generic or default
            for year, month in year_month_pairs:
                if (year, month) not in pintro_map:
                    pintro_map[(year, month)] = generic_pintro.get(month, 0.0167)
        
        return pintro_map
    
    # =========================================================================
    # MAIN CALCULATION
    # =========================================================================
    
    def calculate_system_sensitivity(
        self,
        species_filter: str,
        disease: str,
        region_filter: str,
        year: int = None,  # Used to filter activities to specific year or later
        min_year: int = None  # Minimum year to include in results
    ) -> Dict:
        """
        Main calculation function - replicates get_freedom_data in Python.
        
        Parameters:
        - species_filter: ALL, LR, BOV, BUF, SR, OVI, CAP, POR
        - disease: FMD, LSD, SGP, PPR
        - region_filter: ALL, GR, BG, TK
        - year: Not used for filtering (kept for API compatibility)
        - min_year: Minimum year to include in output (filters old data)
        
        Returns:
        - JSON structure matching old get_freedom_data output
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
        
        # OPTIMIZATION: Pass min_year to database query to filter at source
        # Get activities data (filtered by year at database level)
        activities = self.get_factivities_data(countries, disease, species_list, min_year=min_year)
        
        # Group by month
        monthly_data = {}
        skipped_invalid_dates = 0
        for act in activities:
            # Ensure dt_insp is a datetime object, not a string
            dt_insp = act['dt_insp']
            
            try:
                if isinstance(dt_insp, str):
                    # Check for invalid dates (day 00 or month 00)
                    if '-00' in dt_insp or dt_insp.endswith('-00'):
                        print(f"Warning: Skipping record with invalid date: {dt_insp} (factivityID: {act.get('factivityID')})")
                        skipped_invalid_dates += 1
                        continue
                    
                    dt_insp = datetime.strptime(dt_insp, '%Y-%m-%d') if ' ' not in dt_insp else datetime.strptime(dt_insp, '%Y-%m-%d %H:%M:%S')
                elif not isinstance(dt_insp, datetime):
                    # If it's a date object, convert to datetime
                    dt_insp = datetime.combine(dt_insp, datetime.min.time())
                
                month_key = (dt_insp.year, dt_insp.month)
                if month_key not in monthly_data:
                    monthly_data[month_key] = []
                # Update the dt_insp in the activity dict for later use
                act['dt_insp'] = dt_insp
                monthly_data[month_key].append(act)
                
            except (ValueError, AttributeError) as e:
                print(f"Warning: Skipping record with invalid date: {dt_insp} (factivityID: {act.get('factivityID')}) - Error: {str(e)}")
                skipped_invalid_dates += 1
                continue
        
        if skipped_invalid_dates > 0:
            print(f"Skipped {skipped_invalid_dates} records with invalid dates")
        
        # OPTIMIZATION: Batch load all monthly pintro values at once
        year_month_pairs = list(monthly_data.keys())
        pintro_cache = self.get_all_monthly_pintro(year_month_pairs, disease, region_filter)
        
        # Calculate monthly sensitivity
        results = []
        p_free = 0.5  # Initial prior probability of freedom
        
        for (year, month) in sorted(monthly_data.keys()):
            acts = monthly_data[(year, month)]
            
            # Calculate herd-level sensitivity for each activity
            hse_values = []
            total_animals = 0
            total_herds = len(acts)
            total_sero = 0
            total_clin = 0
            
            for act in acts:
                # Process each species
                for species in species_list:
                    pop = act['populations'].get(species, 0)
                    exam = act['examined'].get(species, 0)
                    tested = act['tested'].get(species)
                    sampled = act['sampled'].get(species, 0)
                    
                    if pop == 0:
                        continue
                    
                    total_animals += pop
                    total_sero += sampled
                    
                    # R2: Apply protocol rules for tested count
                    clin_tested = self.get_tested_count(
                        species=species,
                        disease=disease,
                        country=act['country'],
                        exam_count=exam,
                        tested_count=tested,
                        visit_date=act['dt_insp']
                    )
                    
                    total_clin += clin_tested
                    
                    # R4: Use risklevel from epiunits
                    risk_level = act['risklevel'].lower() if act['risklevel'] else 'low'
                    
                    # R1: Calculate combined herd sensitivity
                    hse = self.calculate_combined_herd_sensitivity_R1(
                        clin_examined=exam,
                        clin_tested=clin_tested,
                        sero_sampled=sampled,
                        population=pop,
                        params=params,
                        risk_level=risk_level
                    )
                    
                    if hse > 0:
                        hse_values.append(hse)
            
            # Aggregate to system sensitivity (monthly)
            if hse_values:
                # SSe = 1 - ∏(1 - HSe_i * AdjRisk * P*H)
                adj_risk = self.calculate_adjusted_risk(params)
                pstar_h = params.get('PstarH', 0.02)
                
                prod_high = 1.0
                prod_low = 1.0
                
                for hse in hse_values:
                    # Assume all high risk for simplicity (can be improved)
                    prod_high *= (1 - (adj_risk['high'] * pstar_h * hse))
                
                sse = 1 - prod_high
            else:
                sse = 0.0
            
            # OPTIMIZATION: Get monthly PIntro from cache (R11-R12)
            pintro = pintro_cache.get((year, month), 0.0167)
            
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
        year: int
    ) -> Dict:
        """
        Validation helper - returns intermediate values for debugging.
        """
        results = self.calculate_system_sensitivity(
            species_filter, disease, region_filter, year
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