# Base-R reference runner for the corrected THRACE freedom model.
# Reproduces update_database_R_corrected.R using base R only (no dplyr/tidyr/lubridate),
# so it runs on the stock R install. The numeric core (get_freedom_data) is copied
# verbatim from the corrected script; only the all_data build was translated to base R.
#
# Outputs:
#   backend/tests/thrace_reference/ref_<DZ>_<SP>_<REG>.csv   (parity fixtures)
#   backend/data/thrace/tot_n_epiunits.csv                   (EDSSe denominators, shipped)

args <- commandArgs(trailingOnly = TRUE)
RDIR  <- if (length(args) >= 1) args[1] else "Thrace/New items/THRACE R version"
REFOUT <- if (length(args) >= 2) args[2] else "backend/tests/thrace_reference"
DATAOUT <- if (length(args) >= 3) args[3] else "backend/data/thrace"

dir.create(REFOUT, recursive = TRUE, showWarnings = FALSE)
dir.create(DATAOUT, recursive = TRUE, showWarnings = FALSE)

cz <- function(x) ifelse(is.na(x), 0, x)

# ---------------------------------------------------------------------------
# Reference config
# ---------------------------------------------------------------------------
params <- read.csv2(file.path(RDIR, "params_corrected.csv"), stringsAsFactors = FALSE)
params$value_fsse  <- as.numeric(params$value_fsse)
params$value_edsse <- as.numeric(params$value_edsse)

monthly_pintro <- read.csv2(file.path(RDIR, "monthly_pintro_corrected.csv"), stringsAsFactors = FALSE)
monthly_pintro$year         <- suppressWarnings(as.integer(monthly_pintro$year))
monthly_pintro$month        <- as.integer(monthly_pintro$month)
monthly_pintro$pintro_fmd   <- as.numeric(monthly_pintro$pintro_fmd)
monthly_pintro$pintro_lsd   <- as.numeric(monthly_pintro$pintro_lsd)
monthly_pintro$pintro_ppr   <- as.numeric(monthly_pintro$pintro_ppr)
monthly_pintro$pintro_spgp  <- as.numeric(monthly_pintro$pintro_spgp)

# ---------------------------------------------------------------------------
# 1. Inputs
# ---------------------------------------------------------------------------
factivities <- read.csv(file.path(RDIR, "factivities.csv"), stringsAsFactors = FALSE)
epiunits    <- read.csv(file.path(RDIR, "epiunits.csv"),    stringsAsFactors = FALSE)
districts   <- read.csv(file.path(RDIR, "districts.csv"),   stringsAsFactors = FALSE)
provinces   <- read.csv(file.path(RDIR, "provinces.csv"),   stringsAsFactors = FALSE)
nations     <- read.csv(file.path(RDIR, "nations_old.csv"), stringsAsFactors = FALSE)

# ---------------------------------------------------------------------------
# 2-3. Cross join factivities x species x disease
# ---------------------------------------------------------------------------
species_vec <- c("cattle", "buffalo", "pig", "sheep", "goat")
disease_vec <- c("FMD", "LSD", "SGP", "PPR")

core <- merge(factivities, data.frame(species = species_vec, stringsAsFactors = FALSE), by = NULL)
core <- merge(core,        data.frame(disease = disease_vec, stringsAsFactors = FALSE), by = NULL)

# ---------------------------------------------------------------------------
# 4. Geography joins
# ---------------------------------------------------------------------------
core <- merge(core, epiunits[, c("epiunitID", "districtID")], by = "epiunitID", all.x = TRUE)
core <- merge(core, districts[, c("districtID", "provinceID", "district_name")], by = "districtID", all.x = TRUE)
core <- merge(core, provinces[, c("provinceID", "nationID", "province_name")], by = "provinceID", all.x = TRUE)
core <- merge(core, nations[, c("nationID", "three_letter_code")], by = "nationID", all.x = TRUE)
names(core)[names(core) == "three_letter_code"] <- "country"

# ---------------------------------------------------------------------------
# 5. Year / month, keep [2016, 2050)
# ---------------------------------------------------------------------------
core$dt_insp <- as.Date(core$dt_insp)
core$year  <- as.integer(format(core$dt_insp, "%Y"))
core$month <- as.integer(format(core$dt_insp, "%m"))
core <- core[!is.na(core$year) & core$year > 2015 & core$year < 2050, ]

# ---------------------------------------------------------------------------
# 6. size / clin / sero (CASE WHEN)
# ---------------------------------------------------------------------------
core$size <- with(core, ifelse(species == "cattle", cz(cattle),
                        ifelse(species == "sheep",  cz(sheep),
                        ifelse(species == "goat",   cz(goat),
                        ifelse(species == "buffalo",cz(buffalo),
                        ifelse(species == "pig",    cz(pig), 0))))))

core$clin <- with(core, ifelse(species == "cattle", cz(cattleexam),
                        ifelse(species == "sheep",  cz(sheepexam),
                        ifelse(species == "goat",   cz(goatsexam),
                        ifelse(species == "buffalo",cz(buffaloesexam), 0)))))

core$sero <- with(core, ifelse(species == "cattle", cz(cattlesample),
                        ifelse(species == "sheep",  cz(sheepsample),
                        ifelse(species == "goat",   cz(goatsample),
                        ifelse(species == "buffalo",cz(buffaloessample),
                        ifelse(species == "pig",    cz(pigssample), 0))))))

# ---------------------------------------------------------------------------
# 7. clinpos / seropos by disease
# ---------------------------------------------------------------------------
core$clinpos <- with(core, ifelse(disease == "FMD" & species == "cattle",  cz(cattlecliposFMD),
                          ifelse(disease == "FMD" & species == "buffalo", cz(buffaloesposFMD),
                          ifelse(disease == "FMD" & species == "sheep",   cz(sheepposFMD),
                          ifelse(disease == "FMD" & species == "goat",    cz(goatsposFMD),
                          ifelse(disease == "LSD" & species == "cattle",  cz(cattlecliposLSD),
                          ifelse(disease == "LSD" & species == "buffalo", cz(buffaloesposLSD),
                          ifelse(disease == "SGP" & species == "sheep",   cz(sheepposSGP),
                          ifelse(disease == "SGP" & species == "goat",    cz(goatsposSGP),
                          ifelse(disease == "PPR" & species == "sheep",   cz(sheepposPPR),
                          ifelse(disease == "PPR" & species == "goat",    cz(goatsposPPR), 0)))))))))))

core$seropos <- with(core, ifelse(disease == "FMD" & species == "cattle",  cz(cattleseroposFMD),
                          ifelse(disease == "FMD" & species == "buffalo", cz(buffaloesseroposFMD),
                          ifelse(disease == "FMD" & species == "sheep",   cz(sheepseroposFMD),
                          ifelse(disease == "FMD" & species == "goat",    cz(goatsseroposFMD),
                          ifelse(disease == "LSD" & species == "cattle",  cz(cattleseroposLSD),
                          ifelse(disease == "LSD" & species == "buffalo", cz(buffaloesseroposLSD),
                          ifelse(disease == "SGP" & species == "sheep",   cz(sheepseroposSGP),
                          ifelse(disease == "SGP" & species == "goat",    cz(goatsseroposSGP),
                          ifelse(disease == "PPR" & species == "sheep",   cz(sheepseroposPPR),
                          ifelse(disease == "PPR" & species == "goat",    cz(goatsseroposPPR), 0)))))))))))

# ---------------------------------------------------------------------------
# 8. size > 0 + impossible species/disease removal
# ---------------------------------------------------------------------------
core <- core[core$size > 0, ]
core <- core[!(
  ((core$species %in% c("cattle", "buffalo")) & (core$disease %in% c("SGP", "PPR"))) |
  ((core$species %in% c("sheep", "goat"))     & (core$disease == "LSD")) |
  ((core$species == "pig")                    & (core$disease %in% c("LSD", "SGP", "PPR")))
), ]

# ---------------------------------------------------------------------------
# 9. Springer deletions
# ---------------------------------------------------------------------------
core <- core[!(
  (core$country == "TUR" & core$disease == "LSD" & core$year <= 2016) |
  (core$country == "TUR" & core$disease == "SGP" & core$year <= 2017) |
  (core$country == "BGR" & core$disease == "LSD" & core$year <= 2016) |
  (core$country == "BGR" & core$disease == "PPR" & core$year <= 2018) |
  (core$country == "GRC" & core$disease == "LSD" & core$year <= 2017) |
  (core$country == "GRC" & core$disease == "SGP" & core$year <= 2018)
), ]

# ---------------------------------------------------------------------------
# 10. Risk levels
# ---------------------------------------------------------------------------
core$risk <- NA_character_

epiunitID_high_risk_BGR <- c(2145, 2153, 2150, 2159, 2162, 2147, 2156, 2149, 2164, 2160,
                             2152, 2155, 2158, 2157, 2154, 2148, 2151, 2163, 2146, 2161)
core$risk[core$epiunitID %in% epiunitID_high_risk_BGR] <- "high"

distric_high_risk_GRC <- c("ORESTIADA", "DIDYMOTEICHO", "FERES", "ALEXANDROUPOLI")
distric_low_risk_GRC  <- c("SOUFLI")
core$risk[core$district_name %in% distric_high_risk_GRC] <- "high"
core$risk[core$district_name %in% distric_low_risk_GRC]  <- "low"

provinces_high_risk_TUR <- c("ISTANBUL")
provinces_low_risk_TUR  <- c("CANAKKALE", "EDIRNE", "KIRKLARELI", "TEKIRDAG")
core$risk[core$province_name %in% provinces_high_risk_TUR] <- "high"
core$risk[core$province_name %in% provinces_low_risk_TUR]  <- "low"

if (any(is.na(core$risk))) {
  bad <- unique(core[is.na(core$risk), c("country", "district_name", "province_name", "epiunitID")])
  print(head(bad, 20))
  stop("ERROR: one risk level not defined.")
}

# ---------------------------------------------------------------------------
# all_data
# ---------------------------------------------------------------------------
all_data <- core[, c("species", "disease", "country", "year", "month",
                     "epiunitID", "size", "risk", "clin", "sero", "clinpos", "seropos")]
all_data <- data.frame(all_data, stringsAsFactors = FALSE)

# sero adjustments
idx <- all_data$country == "GRC" & all_data$disease == "PPR" &
       all_data$species %in% c("sheep", "goat") &
       (all_data$year %in% c(2022, 2023) |
        (all_data$year == 2024 & all_data$month >= 1 & all_data$month <= 6))
all_data$sero[idx] <- floor(all_data$sero[idx] * 0.25)

all_data$sero[all_data$disease == "PPR" & all_data$country == "TUR"] <- 0
all_data$sero[all_data$disease %in% c("SGP", "LSD")] <- 0

# ---------------------------------------------------------------------------
# Pseudo species (all_sp, sr, lr)
# ---------------------------------------------------------------------------
agg_pseudo <- function(df, label) {
  a <- aggregate(cbind(size, clin, sero, clinpos, seropos) ~
                   disease + country + year + month + epiunitID + risk,
                 data = df, sum, na.rm = TRUE)
  a$species <- label
  a[, c("species", "disease", "country", "year", "month",
        "epiunitID", "size", "risk", "clin", "sero", "clinpos", "seropos")]
}

all_sp <- agg_pseudo(all_data, "all_sp")
sr <- agg_pseudo(all_data[all_data$species %in% c("sheep", "goat"), ], "sr")
lr <- agg_pseudo(all_data[all_data$species %in% c("cattle", "buffalo"), ], "lr")
all_data <- rbind(all_data, all_sp, sr, lr)

# ---------------------------------------------------------------------------
# get_param
# ---------------------------------------------------------------------------
get_param <- function(dname, pname, rname, mname) {
  if (length(rname) > 1) rname <- paste0(rname, collapse = ",")
  params[params$disease == dname & params$param == pname & params$region == rname,
         ifelse(mname == "fsse", "value_fsse", "value_edsse")]
}

# ---------------------------------------------------------------------------
# tot_n_epiunits (EDSSe denominators)
# ---------------------------------------------------------------------------
tot_n_epiunits <- data.frame(
  country   = c(rep("BGR", 2), rep("GRC", 2), rep("TUR", 2)),
  risklevel = c(rep(c("high", "low"), 3)),
  n_cattle = NA, n_buffalo = NA, n_lr = NA, n_sheep = NA,
  n_goat = NA, n_sr = NA, n_pig = NA, n_all_sp = NA,
  stringsAsFactors = FALSE
)

census <- read.csv2(file.path(RDIR, "ThraceActivities_all.csv"), stringsAsFactors = FALSE)
# normalise census species columns (header uses goats/pigs)
if (!"pig" %in% names(census) && "pigs" %in% names(census)) census$pig <- census$pigs
adk <- all_data[!duplicated(all_data$epiunitID), c("epiunitID", "country", "risk")]
census <- merge(census, adk, by = "epiunitID", all.x = TRUE)
census$cattle  <- as.numeric(census$cattle)
census$buffalo <- as.numeric(census$buffalo)
census$sheep   <- as.numeric(census$sheep)
census$goats   <- as.numeric(census$goats)
census$pig     <- as.numeric(census$pig)
census$lr     <- census$cattle + census$buffalo
census$sr     <- census$sheep + census$goats
census$all_sp <- census$cattle + census$buffalo + census$sheep + census$goats + census$pig

count_pos <- function(ctry, rsk, col) sum(census[census$country == ctry & census$risk == rsk, col] > 0, na.rm = TRUE)
map_col <- list(n_cattle = "cattle", n_buffalo = "buffalo", n_sheep = "sheep",
                n_goat = "goats", n_pig = "pig", n_lr = "lr", n_sr = "sr", n_all_sp = "all_sp")
for (i in seq_len(nrow(tot_n_epiunits))) {
  ctry <- tot_n_epiunits$country[i]; rsk <- tot_n_epiunits$risklevel[i]
  for (ncol in names(map_col)) tot_n_epiunits[i, ncol] <- count_pos(ctry, rsk, map_col[[ncol]])
}
write.csv(tot_n_epiunits, file.path(DATAOUT, "tot_n_epiunits.csv"), row.names = FALSE)

# ---------------------------------------------------------------------------
# get_freedom_data (numeric core, copied from corrected R; plots removed)
# ---------------------------------------------------------------------------
get_freedom_data <- function(sp, dz, reg, all_data, monthly_pintro) {
  sp_vec <- switch(sp,
                   "ALL" = "all_sp", "LR" = "lr", "BOV" = "cattle", "BUF" = "buffalo",
                   "SR" = "sr", "OVI" = "sheep", "CAP" = "goat", "POR" = "pig",
                   c("cattle", "buffalo", "sheep", "goat", "pig"))
  reg_vec <- switch(reg, "BG" = "BGR", "TK" = "TUR", "GR" = "GRC")

  RR_high  <- get_param(dz, "RR_high", reg_vec, "fsse")
  RR_low   <- get_param(dz, "RR_low", reg_vec, "fsse")
  PrP_high <- get_param(dz, "PrP_high", reg_vec, "fsse")
  ar_high  <- RR_high / ((RR_high * PrP_high) + (RR_low * (1 - PrP_high)))
  ar_low   <- RR_low  / ((RR_high * PrP_high) + (RR_low * (1 - PrP_high)))

  mydata <- all_data[all_data$disease == dz & all_data$species %in% sp_vec &
                       all_data$country %in% reg_vec, ]

  mydata$prior2 <- get_param(dz, "PstarH", reg_vec, "fsse")
  USe2 <- get_param(dz, "USe_2", reg_vec, "fsse")
  PstarA <- get_param(dz, "PstarA", reg_vec, "fsse")
  PstarA_edsse <- get_param(dz, "PstarA", reg_vec, "edsse")

  mydata$seh2 <- 1 - (1 - (USe2 * mydata$clin / mydata$size))^ceiling(mydata$size * PstarA)
  mydata$seh2_edsse <- 1 - (1 - (USe2 * mydata$clin / mydata$size))^ceiling(mydata$size * PstarA_edsse)
  mydata$epi2 <- ifelse(tolower(mydata$risk) == "high", ar_high * mydata$prior2, ar_low * mydata$prior2)
  mydata$p_neg2 <- 1 - (mydata$seh2 * mydata$epi2)
  mydata$post2 <- ifelse(mydata$clin > 0, 1 - (1 - mydata$epi2) / (1 - mydata$epi2 * mydata$seh2), mydata$prior2)

  mydata$prior1 <- mydata$post2
  USe1 <- get_param(dz, "USe_1", reg_vec, "fsse")
  mydata$seh1 <- 1 - (1 - (USe1 * mydata$sero / mydata$size))^ceiling(mydata$size * PstarA)
  mydata$seh1_edsse <- 1 - (1 - (USe1 * mydata$sero / mydata$size))^ceiling(mydata$size * PstarA_edsse)
  mydata$epi1 <- ifelse(tolower(mydata$risk) == "high", ar_high * mydata$prior1, ar_low * mydata$prior1)
  mydata$p_neg1 <- 1 - (mydata$seh1 * mydata$epi1)
  mydata$post1 <- ifelse(mydata$sero > 0, 1 - (1 - mydata$epi1) / (1 - mydata$epi1 * mydata$seh1), mydata$prior1)

  years_months <- unique(mydata[, c("year", "month")])
  years_months <- years_months[order(years_months$year, years_months$month), ]

  outputs <- data.frame()
  for (i in seq_len(nrow(years_months))) {
    y <- years_months$year[i]; m <- years_months$month[i]
    subset_data <- mydata[mydata$year == y & mydata$month == m, ]
    cse_clin <- 1 - exp(sum(log(pmax(subset_data$p_neg2, .Machine$double.eps))))
    cse_sero <- 1 - exp(sum(log(pmax(subset_data$p_neg1, .Machine$double.eps))))
    outputs <- rbind(outputs, data.frame(
      year = y, month = m, cse_clin = cse_clin, cse_sero = cse_sero,
      animals = sum(subset_data$size), herds = nrow(subset_data),
      sero = sum(subset_data$sero), clin = sum(subset_data$clin),
      seropos = sum(subset_data$seropos), clinpos = sum(subset_data$clinpos)
    ))
  }
  outputs$sse <- 1 - (1 - outputs$cse_clin) * (1 - outputs$cse_sero)

  if (dz == "FMD")       monthly_pintro_dz <- monthly_pintro[, c("year", "month", "pintro_fmd")]
  else if (dz == "LSD")  monthly_pintro_dz <- monthly_pintro[, c("year", "month", "pintro_lsd")]
  else if (dz == "PPR")  monthly_pintro_dz <- monthly_pintro[, c("year", "month", "pintro_ppr")]
  else if (dz == "SGP")  monthly_pintro_dz <- monthly_pintro[, c("year", "month", "pintro_spgp")]
  colnames(monthly_pintro_dz) <- c("year", "month", "pintro")

  pintro_default <- monthly_pintro_dz[is.na(monthly_pintro_dz$year), ]
  pintro_year <- monthly_pintro_dz[!is.na(monthly_pintro_dz$year), ]
  outputs <- merge(outputs, pintro_default[, c("month", "pintro")], by = "month", all.x = TRUE)
  names(outputs)[names(outputs) == "pintro"] <- "pintro_default"
  outputs <- merge(outputs, pintro_year[, c("year", "month", "pintro")], by = c("year", "month"), all.x = TRUE)
  names(outputs)[names(outputs) == "pintro"] <- "pintro_year"
  outputs$pintro <- ifelse(is.na(outputs$pintro_year), outputs$pintro_default, outputs$pintro_year)
  outputs$pintro_default <- NULL; outputs$pintro_year <- NULL

  outputs <- outputs[order(outputs$year, outputs$month), ]
  p_free_init <- 0.5
  outputs$prior <- NA; outputs$posterior <- NA
  for (i in seq_len(nrow(outputs))) {
    if (i == 1) {
      outputs$prior[i] <- p_free_init
    } else {
      if (outputs$clinpos[i] + outputs$seropos[i] > 0) {
        outputs$prior[i] <- 0
      } else if ((outputs$clinpos[i] + outputs$seropos[i]) == 0 &
                 (outputs$clinpos[i - 1] + outputs$seropos[i - 1]) > 0) {
        outputs$prior[i] <- p_free_init
      } else {
        outputs$prior[i] <- outputs$posterior[i - 1]
      }
    }
    sse_i <- outputs$sse[i]; pintro_i <- outputs$pintro[i]; prior_i <- outputs$prior[i]
    outputs$posterior[i] <- ((1 - pintro_i) * prior_i) / (1 - sse_i + (prior_i * sse_i))
  }
  outputs$mth <- paste(outputs$year, sprintf("%02d", outputs$month), "01", sep = "-")

  # EDSSe
  t_cov <- get_param(dz, "t_cov", reg_vec, "edsse")
  pr_high <- get_param(dz, "RR_high", reg_vec, "edsse") / (get_param(dz, "RR_high", reg_vec, "edsse") + get_param(dz, "RR_low", reg_vec, "edsse"))
  pr_low  <- get_param(dz, "RR_low", reg_vec, "edsse")  / (get_param(dz, "RR_high", reg_vec, "edsse") + get_param(dz, "RR_low", reg_vec, "edsse"))
  mydata$sehcomb_edsse <- 1 - (1 - mydata$seh2_edsse) * (1 - mydata$seh1_edsse)
  outputs$edsse <- NA
  for (i in seq_len(nrow(years_months))) {
    y <- years_months$year[i]; m <- years_months$month[i]
    subset_data <- mydata[mydata$year == y & mydata$month == m, ]
    ser_low  <- mean(subset_data[subset_data$risk == "low", "sehcomb_edsse"])
    ser_high <- mean(subset_data[subset_data$risk == "high", "sehcomb_edsse"])
    Cpr_low  <- nrow(subset_data[subset_data$risk == "low", ]) /
      tot_n_epiunits[tot_n_epiunits$risklevel == "low" & tot_n_epiunits$country == reg_vec, paste0("n_", sp_vec)]
    Cpr_high <- nrow(subset_data[subset_data$risk == "high", ]) /
      tot_n_epiunits[tot_n_epiunits$risklevel == "high" & tot_n_epiunits$country == reg_vec, paste0("n_", sp_vec)]
    row_idx <- which(outputs$year == y & outputs$month == m)
    outputs$edsse[row_idx] <- ifelse(sum(subset_data$risk == "low") > 0 & sum(subset_data$risk == "high") > 0,
      pr_low * Cpr_low * t_cov * ser_low + pr_high * Cpr_high * t_cov * ser_high,
      ifelse(sum(subset_data$risk == "low") > 0, pr_low * Cpr_low * t_cov * ser_low,
      ifelse(sum(subset_data$risk == "high") > 0, pr_high * Cpr_high * t_cov * ser_high, NA)))
  }
  outputs
}

# ---------------------------------------------------------------------------
# Run test filters and write fixtures
# ---------------------------------------------------------------------------
cases <- list(
  c("FMD", "BOV", "GR"),
  c("PPR", "SR", "GR"),
  c("LSD", "LR", "BG")
)
for (cs in cases) {
  dz <- cs[1]; sp <- cs[2]; reg <- cs[3]
  res <- get_freedom_data(sp, dz, reg, all_data, monthly_pintro)
  fn <- file.path(REFOUT, paste0("ref_", dz, "_", sp, "_", reg, ".csv"))
  write.csv(res[, c("year", "month", "mth", "cse_clin", "cse_sero", "sse",
                    "animals", "herds", "sero", "clin", "seropos", "clinpos",
                    "pintro", "prior", "posterior", "edsse")],
            fn, row.names = FALSE)
  cat("wrote", fn, "rows=", nrow(res), "\n")
}
cat("DONE\n")
