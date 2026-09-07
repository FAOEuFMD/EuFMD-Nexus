import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import text
from database import tcc_engine


def main() -> None:
    with tcc_engine.connect() as conn:
        print("=== Recent marketprice periods ===")
        periods = conn.execute(
            text(
                """
                SELECT periodID, descrizione, dt_from,
                       (SELECT COUNT(*) FROM marketprice mp WHERE mp.periodID = p.periodID) AS row_cnt
                FROM marketprice_period p
                ORDER BY dt_from DESC
                LIMIT 8
                """
            )
        ).mappings().all()
        for p in periods:
            print(dict(p))

        latest = periods[0]["periodID"] if periods else None
        print(f"\nLatest periodID: {latest}")

        if latest:
            print("\n=== Sample marketprice row (latest period) ===")
            row = conn.execute(
                text("SELECT * FROM marketprice WHERE periodID = :pid LIMIT 1"),
                {"pid": latest},
            ).mappings().first()
            if row:
                keys = [
                    "ctl_dis_liveAVG", "ctl_cap_liveAVG", "ctl_dis_meatAVG", "ctl_cap_meatAVG",
                    "shp_dis_liveAVG", "shp_cap_liveAVG", "shp_dis_meatAVG", "shp_cap_meatAVG",
                    "pig_dis_liveAVG", "pig_cap_liveAVG", "pig_dis_meatAVG", "pig_cap_meatAVG",
                ]
                print({k: row.get(k) for k in keys})

        print("\n=== Species comparison (latest period WITH data) ===")
        period_sub = (
            "(SELECT p.periodID FROM marketprice_period p "
            "INNER JOIN marketprice mp ON mp.periodID = p.periodID "
            "ORDER BY p.dt_from DESC LIMIT 1)"
        )
        q = text(
            f"""
            SELECT species,
              ROUND(AVG(district_live_avg), 2) AS district_live_avg,
              ROUND(AVG(capital_live_avg), 2) AS capital_live_avg,
              ROUND(AVG(district_meat_avg), 2) AS district_meat_avg,
              ROUND(AVG(capital_meat_avg), 2) AS capital_meat_avg
            FROM (
              SELECT 'Cattle' AS species,
                ctl_dis_liveAVG AS district_live_avg,
                ctl_cap_liveAVG AS capital_live_avg,
                ctl_dis_meatAVG AS district_meat_avg,
                ctl_cap_meatAVG AS capital_meat_avg
              FROM marketprice mp
              WHERE mp.periodID = {period_sub}
              UNION ALL
              SELECT 'Sheep', shp_dis_liveAVG, shp_cap_liveAVG, shp_dis_meatAVG, shp_cap_meatAVG
              FROM marketprice mp
              WHERE mp.periodID = {period_sub}
              UNION ALL
              SELECT 'Pig', pig_dis_liveAVG, pig_cap_liveAVG, pig_dis_meatAVG, pig_cap_meatAVG
              FROM marketprice mp
              WHERE mp.periodID = {period_sub}
            ) all_species
            GROUP BY species
            """
        )
        for r in conn.execute(q).mappings():
            print(dict(r))

        print("\n=== Period with most non-null cattle prices ===")
        r = conn.execute(
            text(
                """
                SELECT mp.periodID, p.descrizione,
                       SUM(ctl_dis_liveAVG IS NOT NULL OR ctl_cap_liveAVG IS NOT NULL) AS cattle_cols
                FROM marketprice mp
                JOIN marketprice_period p ON p.periodID = mp.periodID
                GROUP BY mp.periodID, p.descrizione
                ORDER BY cattle_cols DESC
                LIMIT 5
                """
            )
        ).mappings().all()
        for x in r:
            print(dict(x))


if __name__ == "__main__":
    main()
